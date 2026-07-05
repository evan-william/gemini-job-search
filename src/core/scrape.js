import { readText } from "./files.js";
import { analyzeFit } from "./scoring.js";
import { extractCompensation, formatCompensation, normalizeCurrency } from "./currency.js";

const JOB_WORDS = [
  "job", "career", "opening", "role", "engineer", "developer", "analyst",
  "designer", "manager", "intern", "remote", "hybrid", "full-time"
];

const STOP_WORDS = new Set([
  "and", "the", "for", "with", "from", "into", "your", "you", "our",
  "job", "jobs", "role", "roles", "remote", "hybrid", "onsite", "work",
  "career", "careers", "page", "public", "posts", "post"
]);

const DEFAULT_DISCOVERY_CONFIG = {
  queries: ["junior ai engineer", "ai product analyst", "data analyst", "software engineer"],
  locations: ["remote", "indonesia", "singapore", "asia"],
  providers: [
    { type: "remotive", queries: ["ai", "data analyst", "software engineer"] },
    { type: "remoteok", queries: ["ai", "javascript", "data"] },
    { type: "arbeitnow" }
  ],
  boards: [],
  filters: {
    titleIncludeAny: ["ai", "ml", "data", "software", "engineer", "developer", "analyst", "product", "backend", "frontend", "fullstack", "intern", "junior"],
    mustIncludeAny: ["ai", "data", "software", "engineer", "developer", "analyst", "product", "intern", "junior"],
    titleExcludeAny: ["account director", "sales", "recruiter", "human resources", "hr administrator", "nurse", "physician", "therapist", "customer support"],
    locationAny: ["remote", "indonesia", "singapore", "asia", "worldwide"]
  }
};

export async function scrapeJobs({ source, profile, limit = 15, preferCurrency = "" }) {
  if (!source) throw new Error("Missing --source <url-or-file>");
  const rawJobs = await collectJobsFromSource({ type: "url", url: source }, Math.max(Number(limit) || 15, 100));
  return rankJobs(rawJobs, { profile, preferCurrency }).slice(0, Number(limit) || 15);
}

export async function discoverJobs({
  profile,
  configPath = "jobs/search.config.json",
  sourcesPath = "jobs/sources.txt",
  query = "",
  limit = 25,
  perSourceLimit = 50,
  preferCurrency = ""
}) {
  const config = await readDiscoveryConfig(configPath);
  const sourceDefs = await buildDiscoverySources({ config, sourcesPath, query });
  const collected = [];
  const errors = [];
  const stats = [];

  for (const sourceDef of sourceDefs) {
    try {
      const jobs = await collectJobsFromSource(sourceDef, perSourceLimit);
      collected.push(...jobs.map((job) => ({
        ...job,
        discoverySource: sourceLabel(sourceDef),
        source: job.source || sourceLabel(sourceDef)
      })));
      stats.push({ source: sourceLabel(sourceDef), found: jobs.length });
    } catch (error) {
      errors.push({ source: sourceLabel(sourceDef), error: error.message });
      stats.push({ source: sourceLabel(sourceDef), found: 0, error: error.message });
    }
  }

  const deduped = dedupeJobs(collected);
  const requestedLimit = Number(limit) || 25;
  const filtered = filterDiscoveredJobs(deduped, config, query);
  const rankedAll = rankJobs(deduped, { profile, preferCurrency })
    .sort((a, b) => b.rankScore - a.rankScore || b.fit.overall - a.fit.overall);
  const filteredKeys = new Set(filtered.map(jobKey));
  const ranked = rankedAll
    .map((job) => ({
      ...job,
      discoveryFilter: filteredKeys.has(jobKey(job)) ? "matched" : "backfill"
    }))
    .slice(0, requestedLimit);

  return {
    jobs: ranked,
    rawJobs: deduped,
    filteredJobs: filtered,
    sources: sourceDefs.map(sourceLabel),
    errors,
    stats,
    config
  };
}

export function renderScrapeReport({
  source,
  sources = [],
  jobs,
  date,
  targetCurrency = "",
  secondaryCurrency = "",
  preferCurrency = "",
  currencyConfig,
  rawOut = "",
  collectedCount = 0,
  filteredCount = 0,
  errors = []
}) {
  const rows = jobs.map((job, index) => {
    const title = job.url ? `[${escapeCell(job.title)}](${job.url})` : escapeCell(job.title);
    const pay = formatCompensation(job.compensation, { targetCurrency, secondaryCurrency, config: currencyConfig });
    const preference = job.payPreferenceMatch ? `, prefers ${normalizeCurrency(preferCurrency)}` : "";
    const sourceCell = escapeCell(job.discoverySource || job.source || source);
    const detail = job.detailFetched ? "detail page" : job.sourceKind || "source";
    return `| ${index + 1} | ${title} | ${escapeCell(job.company || "Unknown")} | ${sourceCell} | ${job.rankScore}/100 | ${job.fit.overall}/100 | ${escapeCell(pay)} | ${detail} | ${job.fit.recommendation}${preference} |`;
  });

  const errorLines = errors.length
    ? errors.map((item) => `- ${item.source}: ${item.error}`).join("\n")
    : "- None";

  return `# Job Search Scrape Report

Date: ${date}

Mode: ${source}
Sources scanned: ${sources.length || 1}
Jobs collected before ranking: ${collectedCount || jobs.length}
Jobs matching target filters: ${filteredCount || jobs.length}
Raw collection: ${rawOut || "not written"}
Display currency: ${normalizeCurrency(targetCurrency) || "original listing currency"}
Secondary currency: ${normalizeCurrency(secondaryCurrency) || "none"}
Preferred pay currency: ${normalizeCurrency(preferCurrency) || "none"}

## Ranked Matches

| Rank | Job | Company | Source | Rank Score | Fit | Pay | Evidence | Recommendation |
| ---: | --- | --- | --- | ---: | ---: | --- | --- | --- |
${rows.length ? rows.join("\n") : "| - | No jobs found | - | - | - | - | - | - | - |"}

## Source Errors

${errorLines}

## Notes

- Discovery mode collects jobs first, writes the raw collection, then ranks the
  roles against the candidate profile.
- Works best on public job APIs, company career pages, JobPosting structured
  data, Ashby, Greenhouse, and Lever boards.
- Some large job boards block automated scraping or prohibit it in their terms.
  Add official career pages or supported public APIs instead of forcing blocked
  pages.
- Currency conversion uses local rates from salary/currency.json or the example
  file. Replace the example rates before making compensation decisions.
- Fit is a local heuristic. Use it as a shortlist, then run the full launch
  workflow on the strongest role.
`;
}

export function renderScrapeSummary({
  source,
  jobs,
  targetCurrency = "",
  secondaryCurrency = "",
  preferCurrency = "",
  currencyConfig,
  count = 5,
  rawOut = "",
  collectedCount = 0
}) {
  const limit = Number(count) || 5;
  const preferred = normalizeCurrency(preferCurrency) || "none";
  const target = normalizeCurrency(targetCurrency) || "original";
  const topJobs = jobs.slice(0, limit);
  const lines = topJobs.map((job, index) => {
    const pay = formatCompensation(job.compensation, { targetCurrency, secondaryCurrency, config: currencyConfig });
    const currencyNote = job.payPreferenceMatch ? `, preferred currency ${normalizeCurrency(preferCurrency)}` : "";
    const link = job.url ? `\n   Job link: ${job.url}` : "\n   Job link: Not listed";
    const origin = job.discoverySource ? `\n   Source: ${job.discoverySource}` : "";
    const company = cleanText(job.company || "Unknown");
    const location = cleanText(job.location || "Not listed");
    return `${index + 1}. ${job.title}\n   Company: ${company}\n   Location: ${location}\n   Rank score: ${job.rankScore}/100 | Fit: ${job.fit.overall}/100 | Pay: ${pay} | Decision: ${job.fit.recommendation}${currencyNote}${origin}${link}`;
  });

  const rawLine = rawOut ? `\nRaw collection: ${rawOut}` : "";
  const collectedLine = collectedCount ? `\nJobs collected before ranking: ${collectedCount}` : "";

  return `CHAT_ROOM_OUTPUT_START

# Top Job Matches

REQUESTED_MATCHES: ${limit}
SHOWING_MATCHES: ${topJobs.length} of ${limit}
AI_AGENT_INSTRUCTION: Copy everything from CHAT_ROOM_OUTPUT_START to CHAT_ROOM_OUTPUT_END into the chat response. Do not summarize. Do not collapse to best match only.

Source: ${source}
Target currency: ${target}
Secondary currency: ${normalizeCurrency(secondaryCurrency) || "none"}
Preferred pay currency: ${preferred}${rawLine}${collectedLine}

${lines.length ? lines.join("\n\n") : "No jobs found."}

CHAT_ROOM_OUTPUT_END`;
}

async function readDiscoveryConfig(configPath) {
  try {
    return normalizeDiscoveryConfig(JSON.parse(await readText(configPath)));
  } catch (error) {
    if (error && error.code !== "ENOENT") throw error;
  }

  try {
    return normalizeDiscoveryConfig(JSON.parse(await readText("jobs/search.config.example.json")));
  } catch {
    return DEFAULT_DISCOVERY_CONFIG;
  }
}

function normalizeDiscoveryConfig(config) {
  return {
    ...DEFAULT_DISCOVERY_CONFIG,
    ...config,
    providers: Array.isArray(config?.providers) ? config.providers : DEFAULT_DISCOVERY_CONFIG.providers,
    boards: Array.isArray(config?.boards) ? config.boards : [],
    queries: Array.isArray(config?.queries) ? config.queries : DEFAULT_DISCOVERY_CONFIG.queries,
    locations: Array.isArray(config?.locations) ? config.locations : DEFAULT_DISCOVERY_CONFIG.locations,
    filters: {
      ...DEFAULT_DISCOVERY_CONFIG.filters,
      ...(config?.filters || {})
    }
  };
}

async function buildDiscoverySources({ config, sourcesPath, query }) {
  const sourceDefs = [];
  const add = (sourceDef) => {
    const normalized = normalizeSourceDef(sourceDef);
    if (!normalized) return;
    if (sourceDefs.some((item) => sourceLabel(item) === sourceLabel(normalized))) return;
    sourceDefs.push(normalized);
  };

  for (const provider of config.providers || []) {
    for (const sourceDef of expandProvider(provider, query)) add(sourceDef);
  }

  for (const board of config.boards || []) add(board);

  if (sourcesPath) {
    try {
      const raw = await readText(sourcesPath);
      raw
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#"))
        .forEach(add);
    } catch (error) {
      if (!error || error.code !== "ENOENT") throw error;
    }
  }

  return sourceDefs;
}

function expandProvider(provider, query) {
  if (!provider) return [];
  const type = String(provider.type || provider.provider || "").toLowerCase();
  if (!type) return [];

  if (type === "remotive" || type === "remoteok") {
    const queries = provider.queries || [provider.query || provider.tag || query || ""];
    return queries.map((item) => ({ ...provider, type, query: item, tag: item }));
  }

  return [{ ...provider, type, query: provider.query || query || "" }];
}

function normalizeSourceDef(sourceDef) {
  if (!sourceDef) return null;
  if (typeof sourceDef === "string") return { type: "url", url: sourceDef };
  if (sourceDef.url) return { ...sourceDef, type: sourceDef.type || "url" };
  return sourceDef.type ? sourceDef : null;
}

async function collectJobsFromSource(sourceDef, limit) {
  const type = String(sourceDef.type || "url").toLowerCase();
  if (type === "remotive") return fetchRemotiveJobs(sourceDef.query, limit);
  if (type === "remoteok") return fetchRemoteOkJobs(sourceDef.tag || sourceDef.query, limit);
  if (type === "arbeitnow") return fetchArbeitnowJobs(limit);
  if (type === "url") return extractSourceJobs(sourceDef.url, limit);
  throw new Error(`Unsupported discovery source type: ${sourceDef.type}`);
}

async function extractSourceJobs(source, limit) {
  const max = Number(limit) || 50;
  const platformJobs = await extractPlatformJobs(source, Math.max(max, 100));
  if (platformJobs.length) return platformJobs.slice(0, max);

  const html = await readSource(source);
  const jobs = extractJsonLdJobs(html, source);
  if (jobs.length) return jobs.slice(0, max);

  const fallbackJobs = await enrichLinkedJobs(extractLinkJobs(html, source), source, max);
  if (fallbackJobs.length) return fallbackJobs.slice(0, max);

  return [extractPlainTextJob(html, source)];
}

function rankJobs(jobs, { profile, preferCurrency = "" }) {
  const preferred = normalizeCurrency(preferCurrency);
  return dedupeJobs(jobs)
    .map((job) => {
      const text = [job.title, job.company, job.location, job.description, job.url].filter(Boolean).join("\n");
      const fit = analyzeFit(profile, text);
      const compensation = extractCompensation(text);
      const payPreferenceMatch = Boolean(preferred && compensation?.currency === preferred);
      const titleBoost = titleRelevanceBoost(job.title);
      const rankScore = fit.overall + titleBoost + (payPreferenceMatch ? 5 : 0);
      return { ...job, fit, rankScore, compensation, payPreferenceMatch };
    })
    .sort((a, b) => b.rankScore - a.rankScore || b.fit.overall - a.fit.overall);
}

function filterDiscoveredJobs(jobs, config, query) {
  const includeTitleTerms = [
    ...((config.filters && config.filters.titleIncludeAny) || [])
  ].flatMap(importantTerms);
  const excludeTitleTerms = [
    ...((config.filters && config.filters.titleExcludeAny) || [])
  ].map((term) => String(term || "").toLowerCase().trim()).filter(Boolean);
  const roleTerms = [
    query,
    ...(config.queries || []),
    ...((config.filters && config.filters.mustIncludeAny) || [])
  ].flatMap(importantTerms);

  const locationTerms = [
    ...(config.locations || []),
    ...((config.filters && config.filters.locationAny) || [])
  ].flatMap(importantTerms);

  let filtered = excludeTitleTerms.length
    ? jobs.filter((job) => !excludeTitleTerms.some((term) => String(job.title || "").toLowerCase().includes(term)))
    : jobs;

  const titleFiltered = includeTitleTerms.length
    ? filtered.filter((job) => matchesAny(job.title, includeTitleTerms))
    : filtered;
  if (titleFiltered.length >= Math.min(5, filtered.length)) filtered = titleFiltered;

  filtered = roleTerms.length
    ? filtered.filter((job) => matchesAny([job.title, job.description, job.url].join(" "), roleTerms))
    : filtered;

  if (locationTerms.length) {
    const locationFiltered = filtered.filter((job) => {
      const haystack = [job.location, job.description].join(" ");
      return matchesAny(haystack, locationTerms);
    });
    if (locationFiltered.length >= Math.min(3, filtered.length)) filtered = locationFiltered;
  }

  return filtered.length ? filtered : jobs;
}

function titleRelevanceBoost(title) {
  const value = String(title || "").toLowerCase();
  let score = 0;
  if (/\b(ai|ml|machine learning|llm|data|software|developer|engineer|analyst|product)\b/.test(value)) score += 8;
  if (/\b(junior|intern|graduate|associate|entry)\b/.test(value)) score += 4;
  if (/\b(account director|sales|recruiter|human resources|nurse|physician|therapist)\b/.test(value)) score -= 12;
  return score;
}

function importantTerms(value) {
  return String(value || "")
    .toLowerCase()
    .split(/[^a-z0-9+#.]+/)
    .map((term) => term.trim())
    .filter((term) => term.length >= 2 && !STOP_WORDS.has(term));
}

function matchesAny(value, terms) {
  const haystack = String(value || "").toLowerCase();
  return terms.some((term) => haystack.includes(term));
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

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "accept": "application/json",
      "user-agent": "gemini-job-search-os/0.1 (+https://github.com)",
      ...(options.headers || {})
    }
  });
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);
  return response.json();
}

async function fetchRemotiveJobs(query, limit) {
  const url = new URL("https://remotive.com/api/remote-jobs");
  if (query) url.searchParams.set("search", query);
  const payload = await fetchJson(url);
  const jobs = Array.isArray(payload.jobs) ? payload.jobs : [];
  return jobs.slice(0, limit).map((job) => ({
    title: cleanText(job.title || "Untitled role"),
    company: cleanText(job.company_name || ""),
    location: cleanText(job.candidate_required_location || "Remote"),
    description: cleanText(stripHtml([
      job.title,
      job.job_type,
      job.category,
      job.salary,
      job.tags?.join(", "),
      job.description
    ].filter(Boolean).join("\n"))).slice(0, 12000),
    url: job.url || "",
    source: `Remotive: ${query || "all"}`,
    sourceKind: "Remotive API"
  }));
}

async function fetchRemoteOkJobs(tag, limit) {
  const url = new URL("https://remoteok.com/api");
  if (tag) url.searchParams.set("tags", tag);
  const payload = await fetchJson(url);
  const jobs = Array.isArray(payload) ? payload.filter((job) => job && job.position) : [];
  return jobs.slice(0, limit).map((job) => {
    const salary = [job.salary_min, job.salary_max].filter(Boolean).join(" - ");
    return {
      title: cleanText(job.position || "Untitled role"),
      company: cleanText(job.company || ""),
      location: cleanText(job.location || "Remote"),
      description: cleanText(stripHtml([
        job.position,
        job.tags?.join(", "),
        salary,
        job.description
      ].filter(Boolean).join("\n"))).slice(0, 12000),
      url: job.url || (job.id ? `https://remoteok.com/remote-jobs/${job.id}` : ""),
      source: `RemoteOK: ${tag || "all"}`,
      sourceKind: "RemoteOK API"
    };
  });
}

async function fetchArbeitnowJobs(limit) {
  const payload = await fetchJson("https://www.arbeitnow.com/api/job-board-api");
  const jobs = Array.isArray(payload.data) ? payload.data : [];
  return jobs.slice(0, limit).map((job) => ({
    title: cleanText(job.title || "Untitled role"),
    company: cleanText(job.company_name || ""),
    location: cleanText([job.location, job.remote ? "Remote" : ""].filter(Boolean).join(", ")),
    description: cleanText(stripHtml([
      job.title,
      job.tags?.join(", "),
      job.description
    ].filter(Boolean).join("\n"))).slice(0, 12000),
    url: job.url || "",
    source: "Arbeitnow",
    sourceKind: "Arbeitnow API"
  }));
}

async function extractPlatformJobs(source, limit) {
  const ashby = parseAshbySource(source);
  if (ashby) return fetchAshbyJobs(ashby, limit);

  const greenhouse = parseGreenhouseSource(source);
  if (greenhouse) return fetchGreenhouseJobs(greenhouse, limit);

  const lever = parseLeverSource(source);
  if (lever) return fetchLeverJobs(lever, limit);

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
      source: `Ashby: ${pageName}`,
      sourceKind: "Ashby API",
      detailFetched: true
    };
  });
}

function parseGreenhouseSource(source) {
  try {
    const url = new URL(source);
    if (!/(^|\.)greenhouse\.io$/i.test(url.hostname)) return null;
    const boardToken = url.pathname.split("/").filter(Boolean)[0];
    return boardToken ? { boardToken } : null;
  } catch {
    return null;
  }
}

async function fetchGreenhouseJobs({ boardToken }, limit) {
  const payload = await fetchJson(`https://boards-api.greenhouse.io/v1/boards/${boardToken}/jobs?content=true`);
  const jobs = Array.isArray(payload.jobs) ? payload.jobs : [];
  return jobs.slice(0, limit).map((job) => ({
    title: cleanText(job.title || "Untitled role"),
    company: boardToken,
    location: cleanText(job.location?.name || ""),
    description: cleanText(stripHtml([
      job.title,
      job.location?.name,
      job.content,
      ...(job.departments || []).map((department) => department.name)
    ].filter(Boolean).join("\n"))).slice(0, 12000),
    url: job.absolute_url || "",
    source: `Greenhouse: ${boardToken}`,
    sourceKind: "Greenhouse API",
    detailFetched: true
  }));
}

function parseLeverSource(source) {
  try {
    const url = new URL(source);
    if (url.hostname !== "jobs.lever.co") return null;
    const company = url.pathname.split("/").filter(Boolean)[0];
    return company ? { company } : null;
  } catch {
    return null;
  }
}

async function fetchLeverJobs({ company }, limit) {
  const payload = await fetchJson(`https://api.lever.co/v0/postings/${company}?mode=json`);
  const jobs = Array.isArray(payload) ? payload : [];
  return jobs.slice(0, limit).map((job) => ({
    title: cleanText(job.text || "Untitled role"),
    company,
    location: cleanText(job.categories?.location || ""),
    description: cleanText(stripHtml([
      job.text,
      job.categories?.team,
      job.categories?.commitment,
      job.descriptionPlain,
      ...(job.lists || []).map((list) => `${list.text}\n${(list.content || "").replace(/<br\s*\/?>/gi, "\n")}`)
    ].filter(Boolean).join("\n"))).slice(0, 12000),
    url: job.hostedUrl || job.applyUrl || "",
    source: `Lever: ${company}`,
    sourceKind: "Lever API",
    detailFetched: true
  }));
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
      url: absolutizeUrl(value.url || value.sameAs || source, source),
      source: source,
      sourceKind: "JobPosting JSON-LD"
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
      url: absolutizeUrl(href, source),
      source: source,
      sourceKind: "link"
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
    url: /^https?:\/\//i.test(source) ? source : "",
    source: source,
    sourceKind: "saved text"
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
    const key = jobKey(job);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function jobKey(job) {
  return `${job.title}|${job.company}|${job.url}`.toLowerCase();
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
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
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

function sourceLabel(sourceDef) {
  const type = String(sourceDef.type || "url").toLowerCase();
  if (type === "url") return sourceDef.url;
  if (type === "remotive") return `Remotive search: ${sourceDef.query || "all"}`;
  if (type === "remoteok") return `RemoteOK tag: ${sourceDef.tag || sourceDef.query || "all"}`;
  if (type === "arbeitnow") return "Arbeitnow API";
  return `${sourceDef.type}: ${sourceDef.query || sourceDef.url || "all"}`;
}

function escapeCell(value) {
  return String(value || "").replace(/\|/g, "\\|");
}
