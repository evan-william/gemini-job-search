#!/usr/bin/env node
import { readBundle, parseArgs, requireFlag, slugify, todayISO, readText, readTextWithFallback, writeText } from "./core/files.js";
import {
  renderAudit,
  renderInterviewPack,
  renderOutreach,
  renderPortfolioPlan,
  renderPrompt
} from "./core/scoring.js";
import { scrapeJobs, renderScrapeReport, renderScrapeSummary } from "./core/scrape.js";
import { convertRange, formatRange, normalizeCurrency, readCurrencyConfig } from "./core/currency.js";

const HELP = `Gemini Job Search OS

Usage:
  node src/cli.js demo
  node src/cli.js launch --profile <file> --job <file>
  node src/cli.js scrape --profile <file> --source <url-or-file> --target-currency IDR --prefer-currency USD --show
  node src/cli.js scrape --profile <file> --sources jobs/sources.txt --target-currency IDR --show 10
  node src/cli.js salary --company <name>
  node src/cli.js audit --profile <file> --job <file>
  node src/cli.js portfolio --profile <file> --job <file>
  node src/cli.js outreach --profile <file> --job <file>
  node src/cli.js interview --profile <file> --job <file>
  node src/cli.js prompt --workflow full --profile <file> --job <file>

Examples:
  npm run demo
  node src/cli.js audit --profile profile/candidate.md --job samples/job-posting.md
  node src/cli.js scrape --profile profile/candidate.md --source https://example.com/careers --target-currency IDR --show
  node src/cli.js scrape --profile profile/candidate.md --sources jobs/sources.txt --target-currency IDR --print
`;

async function main() {
  const flags = parseArgs(process.argv.slice(2));
  const command = flags._[0] || "help";

  if (command === "help" || flags.help) {
    console.log(HELP);
    return;
  }

  if (command === "demo") {
    await runAll({
      profile: "profile/candidate.md",
      job: "samples/job-posting.md"
    });
    console.log("Demo complete. Outputs written under workspace/.");
    return;
  }

  if (command === "launch") {
    await runAll(flags);
    console.log("Launch complete. Outputs written under workspace/.");
    return;
  }

  if (command === "scrape") {
    const result = await runScrape(flags);
    console.log(`Scrape report written to ${result.out}`);
    if (result.display) console.log(`\n${result.display}`);
    return;
  }

  if (command === "audit") {
    const output = await buildAudit(flags);
    console.log(`Audit written to ${output}`);
    return;
  }

  if (command === "portfolio") {
    const output = await buildPortfolio(flags);
    console.log(`Portfolio plan written to ${output}`);
    return;
  }

  if (command === "outreach") {
    const output = await buildOutreach(flags);
    console.log(`Outreach drafts written to ${output}`);
    return;
  }

  if (command === "interview") {
    const output = await buildInterview(flags);
    console.log(`Interview pack written to ${output}`);
    return;
  }

  if (command === "prompt") {
    const output = await buildPrompt(flags);
    console.log(`AI-review prompt written to ${output}`);
    return;
  }

  if (command === "salary") {
    await runSalary(flags);
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

async function runAll(flags) {
  await buildAudit(flags);
  await buildPortfolio(flags);
  await buildOutreach(flags);
  await buildInterview(flags);
  await buildPrompt({ ...flags, workflow: "full" });
}

async function runScrape(flags) {
  const profilePath = requireFlag(flags, "profile", "profile/candidate.md");
  const sources = await resolveSources(flags);
  const profile = await readTextWithFallback(profilePath, "profile/candidate.example.md");
  const currencyConfig = await readCurrencyConfig();
  const targetCurrency = flags["target-currency"] || flags.currency || "";
  const preferCurrency = flags["prefer-currency"] || flags["pay-currency"] || "";
  const limit = Number(flags.limit || 15);
  const batches = [];
  for (const source of sources) {
    const jobs = await scrapeJobs({ source, profile, limit, preferCurrency });
    batches.push({ source, jobs });
  }
  const jobs = batches.flatMap((batch) => batch.jobs.map((job) => ({ ...job, source: batch.source })))
    .sort((a, b) => b.rankScore - a.rankScore || b.fit.overall - a.fit.overall)
    .slice(0, limit);
  const sourceLabel = sources.length === 1 ? sources[0] : `${sources.length} sources`;
  const out = flags.out || `workspace/scrape/${slugify(sourceLabel)}.md`;
  const report = renderScrapeReport({ source: sourceLabel, sources, jobs, date: todayISO(), targetCurrency, preferCurrency, currencyConfig });
  await writeText(out, report);
  let display = "";
  if (flags.print) {
    display = report.trim();
  } else if (flags.show) {
    const count = flags.show === true ? 5 : flags.show;
    display = renderScrapeSummary({ source: sourceLabel, jobs, targetCurrency, preferCurrency, currencyConfig, count });
  }
  return { out, display };
}

async function resolveSources(flags) {
  if (flags.source) return [flags.source];
  if (flags.sources) {
    let raw;
    try {
      raw = await readText(flags.sources);
    } catch (error) {
      if (error && error.code === "ENOENT") {
        throw new Error([
          `${flags.sources} does not exist yet.`,
          "Copy jobs/sources.example.txt to jobs/sources.txt and add real public career URLs.",
          "Or run a one-off scrape with --source https://company.com/careers.",
          "For the bundled sample only, run npm run scrape:demo."
        ].join("\n"));
      }
      throw error;
    }
    const sources = raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"));
    if (sources.length) return sources;
    throw new Error(`${flags.sources} does not contain any sources.`);
  }
  throw new Error([
    "Real scrape needs a source.",
    "Use: node src/cli.js scrape --profile profile/candidate.md --source https://company.com/careers --target-currency IDR",
    "Or create jobs/sources.txt from jobs/sources.example.txt, then run npm run scrape.",
    "For the bundled sample only, run npm run scrape:demo."
  ].join("\n"));
}

async function buildAudit(flags) {
  const bundle = await readBundle(flags);
  const out = flags.out || `workspace/audits/${slugify(bundle.jobPath)}.md`;
  await writeText(out, renderAudit({ ...bundle, date: todayISO() }));
  return out;
}

async function buildPortfolio(flags) {
  const bundle = await readBundle(flags);
  const out = flags.out || `workspace/portfolio/${slugify(bundle.jobPath)}.md`;
  await writeText(out, renderPortfolioPlan({ ...bundle, date: todayISO() }));
  return out;
}

async function buildOutreach(flags) {
  const bundle = await readBundle(flags);
  const out = flags.out || `workspace/outreach/${slugify(bundle.jobPath)}.md`;
  await writeText(out, renderOutreach({ ...bundle, date: todayISO() }));
  return out;
}

async function buildInterview(flags) {
  const bundle = await readBundle(flags);
  const out = flags.out || `workspace/interviews/${slugify(bundle.jobPath)}.md`;
  await writeText(out, renderInterviewPack({ ...bundle, date: todayISO() }));
  return out;
}

async function buildPrompt(flags) {
  const bundle = await readBundle(flags);
  const workflow = flags.workflow || "full";
  const out = flags.out || `workspace/prompts/${workflow}-${slugify(bundle.jobPath)}.md`;
  await writeText(out, renderPrompt({ workflow, ...bundle }));
  return out;
}

async function runSalary(flags) {
  const company = flags.company || flags._[1];
  if (!company) throw new Error("Missing --company <name>");
  const currencyConfig = await readCurrencyConfig();
  let data;
  try {
    data = JSON.parse(await readText("salary/benchmarks.json"));
  } catch {
    data = JSON.parse(await readText("salary/benchmarks.example.json"));
  }
  const companies = Array.isArray(data.companies) ? data.companies : [];
  const match = companies.find((entry) => normalize(entry.company).includes(normalize(company)) || normalize(company).includes(normalize(entry.company)));
  if (!match) {
    console.log(`No salary benchmark found for ${company}.`);
    console.log("Create salary/benchmarks.json from salary/benchmarks.example.json.");
    return;
  }
  console.log(`# Salary Benchmark: ${match.company}`);
  console.log("");
  console.log(`Location: ${match.location || "N/A"}`);
  console.log(`Source: ${data.metadata?.source || "N/A"}`);
  console.log(`Currency: ${data.metadata?.currency || "N/A"}`);
  console.log(`Period: ${data.metadata?.period || "N/A"}`);
  if (flags["target-currency"] || flags.currency) {
    console.log(`Target currency: ${normalizeCurrency(flags["target-currency"] || flags.currency)}`);
  }
  console.log("");
  for (const [role, range] of Object.entries(match.roles || {})) {
    const sourceRange = {
      currency: normalizeCurrency(range.currency || match.currency || data.metadata?.currency),
      min: range.min,
      max: range.max,
      period: range.period || data.metadata?.period || ""
    };
    const converted = flags["target-currency"] || flags.currency
      ? convertRange(sourceRange, flags["target-currency"] || flags.currency, currencyConfig)
      : null;
    const mid = range.mid ? `, midpoint ${range.mid}` : "";
    const convertedText = converted ? ` / approx ${formatRange(converted)}` : "";
    console.log(`- ${role}: ${formatRange(sourceRange)}${mid}${convertedText}`);
    if (range.notes) console.log(`  ${range.notes}`);
  }
}

function normalize(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
