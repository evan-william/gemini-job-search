import { readText } from "./files.js";
import { analyzeFit } from "./scoring.js";
import { extractCompensation, formatCompensation, normalizeCurrency } from "./currency.js";

const JOB_WORDS = [
  "job", "career", "opening", "role", "engineer", "developer", "analyst",
  "designer", "manager", "intern", "remote", "hybrid", "full-time"
];

export async function scrapeJobs({ source, profile, limit = 15, preferCurrency = "" }) {
  if (!source) throw new Error("Missing --source <url-or-file>");

  const max = Number(limit) || 15;
  const platformJobs = await extractPlatformJobs(source, Math.max(max * 10, 100));
  const html = platformJobs.length ? "" : await readSource(source);
  const jobs = platformJobs.length ? platformJobs : extractJsonLdJobs(html, source);
  const fallbackJobs = jobs.length ? [] : await enrichLinkedJobs(extractLinkJobs(html, source), source, max);
  const textFallback = jobs.length || fallbackJobs.length ? [] : [extractPlainTextJob(html, source)];
  const preferred = normalizeCurrency(preferCurrency);
  const extracted = [...jobs, ...fallbackJobs, ...textFallback].slice(0, max);

  return extracted
    .map((job) => {
      const text = [job.title, job.company, job.location, job.description, job.url].filter(Boolean).join("\n");
      const fit = analyzeFit(profile, text);
      const compensation = extractCompensation(text);
      const payPreferenceMatch = Boolean(preferred && compensation?.currency === preferred);
      const rankScore = fit.overall + (payPreferenceMatch ? 5 : 0);
      return { ...job, fit, rankScore, compensation, payPreferenceMatch, source };
    })
    .sort((a, b) => b.rankScore - a.rankScore || b.fit.overall - a.fit.overall);
}

export function renderScrapeReport({ source, sources = [], jobs, date, targetCurrency = "", preferCurrency = "", currencyConfig }) {
  const rows = jobs.map((job, index) => {
    const title = job.url ? `[${escapeCell(job.title)}](${job.url})` : escapeCell(job.title);
    const pay = formatCompensation(job.compensation, { targetCurrency, config: currencyConfig });
    const preference = job.payPreferenceMatch ? `, prefers ${normalizeCurrency(preferCurrency)}` : "";
    const sourceCell = escapeCell(job.source || source);
    const detail = job.detailFetched ? "detail page" : job.sourceKind || "source";
    return `| ${index + 1} | ${title} | ${escapeCell(job.company || "Unknown")} | ${sourceCell} | ${job.fit.overall}/100 | ${escapeCell(pay)} | ${detail} | ${job.fit.recommendation}${preference} |`;
  });

  return `# Job Search Scrape Report

Date: ${date}

Source: ${source}
Sources scanned: ${sources.length || 1}
Target currency: ${normalizeCurrency(targetCurrency) || "original listing currency"}
Preferred pay currency: ${normalizeCurrency(preferCurrency) || "none"}

## Ranked Matches

| Rank | Job | Company | Source | Fit | Pay | Evidence | Recommendation |
| ---: | --- | --- | --- | ---: | --- | --- | --- |
${rows.length ? rows.join("\n") : "| - | No jobs found | - | - | - | - | - | - |"}

## Notes

- This report is generated from the source above. If the source is
  'samples/job-posting.md', it is only a demo. Use '--source <career-url>' or
  'jobs/sources.txt' for real scraping.
- Works best on public company career pages with readable HTML or JobPosting JSON-LD.
- Some large job boards block automated scraping. Use a public career page, RSS feed,
  or paste a saved HTML/job post when that happens.
- Currency conversion uses local rates from salary/currency.json or the example
  file. Replace the example rates before making compensation decisions.
- Fit is a local heuristic. Use it as a shortlist, then run the full launch
  workflow on the strongest role.
`;
}

export function renderScrapeSummary({ source, jobs, targetCurrency = "", preferCurrency = "", currencyConfig, count = 5 }) {
  const limit = Number(count) || 5;
  const preferred = normalizeCurrency(preferCurrency) || "none";
  const target = normalizeCurrency(targetCurrency) || "original";
  const topJobs = jobs.slice(0, limit);
  const lines = topJobs.map((job, index) => {
    const pay = formatCompensation(job.compensation, { targetCurrency, config: currencyConfig });
    const currencyNote = job.payPreferenceMatch ? `, preferred currency ${normalizeCurrency(preferCurrency)}` : "";
    const link = job.url ? `\n   ${job.url}` : "";
    return `${index + 1}. ${job.title} - ${job.company || "Unknown"}\n   Fit: ${job.fit.overall}/100 | Pay: ${pay} | ${job.fit.recommendation}${currencyNote}${link}`;
  });

  return `# Top Job Matches

Source: ${source}
Target currency: ${target}
Preferred pay currency: ${preferred}

${lines.length ? lines.join("\n\n") : "No jobs found."}`;
}

async function readSource(source) {
  if (/^https?:\/\//i.test(source)) {
    const response = await fetch(source, {
      headers: {
        "user-agent": "gemini-job-search-os/0.1 (+https://github.com)"
      }
    });
    if (!response.ok) throw new Error(`Failed to fetch ${source}: ${response.status}`);
    return response.text();
  }
  return readText(source);
}

async function extractPlatformJobs(source, limit) {
  const ashby = parseAshbySource(source);
  if (ashby) return fetchAshbyJobs(ashby, limit);
  return [];
}

function parseAshbySource(source) {
  try {
    const url = new URL(source);
    if (url.hostname !== "jobs.ashbyhq.com") return null;
    const pageName = url.pathname.split("/").filter(Boolean)[0];
    return pageName ? { pageName, origin: `${url.origin}/${pageName}` } : null;
  } catch {
    return null;
  }
}

async function fetchAshbyJobs({ pageName, origin }, limit) {
  const query = `query ApiJobBoardWithTeams($organizationHostedJobsPageName: String!) {
    jobBoard: jobBoardWithTeams(organizationHostedJobsPageName: $organizationHostedJobsPageName) {
      teams { id name externalName parentTeamId }
      jobPostings {
        id
        title
        teamId
        locationId
        locationName
        employmentType
        compensationTierSummary
        secondaryLocations { locationName }
      }
    }
  }`;
  const response = await fetch("https://jobs.ashbyhq.com/api/non-user-graphql?op=ApiJobBoardWithTeams", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      operationName: "ApiJobBoardWithTeams",
      variables: { organizationHostedJobsPageName: pageName },
      query
    })
  });
  if (!response.ok) return [];
  const payload = await response.json();
  const postings = payload?.data?.jobBoard?.jobPostings;
  if (!Array.isArray(postings)) return [];
  return postings.slice(0, limit).map((posting) => {
    const locations = [
      posting.locationName,
      ...(posting.secondaryLocations || []).map((location) => location.locationName)
    ].filter(Boolean);
    const compensation = typeof posting.compensationTierSummary === "string"
      ? posting.compensationTierSummary
      : JSON.stringify(posting.compensationTierSummary || "");
    return {
      title: cleanText(posting.title || "Untitled role"),
      company: pageName,
      location: cleanText(locations.join(", ")),
      description: cleanText([
        posting.title,
        posting.employmentType,
        locations.join(", "),
        compensation
      ].filter(Boolean).join("\n")),
      url: `${origin}/${posting.id}`,
      sourceKind: "Ashby API",
      detailFetched: true
    };
  });
}

function extractJsonLdJobs(html, source) {
  const jobs = [];
  const scripts = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi) || [];

  for (const script of scripts) {
    const json = script.replace(/^<script[^>]*>/i, "").replace(/<\/script>$/i, "").trim();
    try {
      collectJobPosting(JSON.parse(json), jobs, source);
    } catch {
      // Ignore unrelated or malformed structured data.
    }
  }

  return dedupeJobs(jobs);
}

function collectJobPosting(value, jobs, source) {
  if (!value) return;
  if (Array.isArray(value)) {
    for (const item of value) collectJobPosting(item, jobs, source);
    return;
  }
  if (typeof value !== "object") return;

  const graph = value["@graph"];
  if (graph) collectJobPosting(graph, jobs, source);

  const type = value["@type"];
  const types = Array.isArray(type) ? type : [type];
  if (types.some((item) => String(item).toLowerCase() === "jobposting")) {
    jobs.push({
      title: cleanText(value.title || "Untitled role"),
      company: cleanText(value.hiringOrganization?.name || value.organization?.name || ""),
      location: cleanText(extractLocation(value.jobLocation)),
      description: cleanText(stripHtml(value.description || "")),
      url: absolutizeUrl(value.url || value.sameAs || source, source)
    });
  }
}

function extractLinkJobs(html, source) {
  const links = [];
  const anchorPattern = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = anchorPattern.exec(html))) {
    const href = match[1];
    const label = cleanText(stripHtml(match[2]));
    if (!label || label.length < 4 || label.length > 120) continue;
    const haystack = `${label} ${href}`.toLowerCase();
    if (!JOB_WORDS.some((word) => haystack.includes(word))) continue;
    links.push({
      title: label,
      company: inferCompanyFromSource(source),
      location: "",
      description: label,
      url: absolutizeUrl(href, source)
    });
  }

  return dedupeJobs(links);
}

async function enrichLinkedJobs(jobs, source, limit) {
  if (!/^https?:\/\//i.test(source)) {
    return jobs.map((job) => ({ ...job, sourceKind: "saved file" }));
  }

  const enriched = [];
  for (const job of jobs.slice(0, limit)) {
    if (!job.url || !/^https?:\/\//i.test(job.url)) {
      enriched.push({ ...job, sourceKind: "link only" });
      continue;
    }
    try {
      const detailHtml = await readSource(job.url);
      const structured = extractJsonLdJobs(detailHtml, job.url)[0];
      if (structured) {
        enriched.push({ ...structured, sourceKind: "structured data", detailFetched: true });
      } else {
        enriched.push({
          ...job,
          title: extractTitle(detailHtml) || job.title,
          description: cleanText(stripHtml(detailHtml)).slice(0, 8000),
          sourceKind: "detail page",
          detailFetched: true
        });
      }
    } catch {
      enriched.push({ ...job, sourceKind: "link only" });
    }
  }
  return enriched;
}

function extractPlainTextJob(text, source) {
  const clean = cleanText(stripHtml(text));
  const heading = String(text).match(/^#\s*(.+)$/m);
  return {
    title: cleanText(heading?.[1] || "Saved job source"),
    company: inferCompanyFromText(text) || inferCompanyFromSource(source),
    location: "",
    description: clean,
    url: /^https?:\/\//i.test(source) ? source : ""
  };
}

function extractTitle(html) {
  const h1 = String(html).match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1) return cleanText(stripHtml(h1[1]));
  const title = String(html).match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  return title ? cleanText(stripHtml(title[1])) : "";
}

function dedupeJobs(jobs) {
  const seen = new Set();
  return jobs.filter((job) => {
    const key = `${job.title}|${job.company}|${job.url}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function extractLocation(value) {
  if (!value) return "";
  const first = Array.isArray(value) ? value[0] : value;
  const address = first?.address || first;
  return [
    address?.addressLocality,
    address?.addressRegion,
    address?.addressCountry
  ].filter(Boolean).join(", ");
}

function stripHtml(value) {
  return String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ");
}

function cleanText(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function absolutizeUrl(value, source) {
  if (!value) return "";
  try {
    return new URL(value, source).toString();
  } catch {
    return value;
  }
}

function inferCompanyFromSource(source) {
  try {
    return new URL(source).hostname.replace(/^www\./, "");
  } catch {
    return "Local source";
  }
}

function inferCompanyFromText(text) {
  const match = text.match(/\bcompany:\s*([^\n\r]+)/i);
  return match ? cleanText(match[1]) : "";
}

function escapeCell(value) {
  return String(value || "").replace(/\|/g, "\\|");
}
