<p align="center">
  <img src="assets/gemini.gif" alt="Gemini Job Search OS demo" width="820">
</p>

# Gemini Job Search OS

A local-first job search operating system for people who want better signal
before they apply.

Drop in a CV, add a job post or public career page, and run one command. The
repo audits fit, finds ATS and proof gaps, creates portfolio project ideas,
drafts outreach, prepares interview objections, ranks public job matches, and
generates an AI-review prompt for Gemini, Codex, or any model interface.

```bash
npm run launch
```

## What This Is

Most AI job tools rewrite resumes. That is not enough.

Hiring teams reject candidates because the evidence is weak, the portfolio does
not prove the role, the outreach is generic, or the candidate is applying to the
wrong jobs. This repo turns the job search into a repeatable pipeline:

```text
profile/candidate.pdf
                 +
          job posting markdown
                 |
                 v
 CV import -> candidate.md -> recruiter audit -> proof gap map
                 |          |             |
                 v          v             v
          resume draft   outreach   interview prep
                 \__________|_____________/
                            v
                   apply / fix / pause / skip
```

## Quick Start

```bash
git clone <your-fork-url>
cd gemini-job-search-os
npm run launch
```

Fresh clones run with `profile/candidate.example.md` as safe demo data. For real
use, add your own `profile/candidate.pdf`; the generated Markdown stays private.

Outputs are written to:

```text
workspace/audits/
workspace/portfolio/
workspace/outreach/
workspace/interviews/
workspace/prompts/
workspace/resume/
workspace/scrape/
```

## Use Your Own CV

The only CV file users need to add is:

```text
profile/candidate.pdf
```

Then run:

```bash
npm run launch
```

`npm run launch` automatically imports the PDF before running the job workflow.
To force-refresh the Markdown cache after replacing the PDF, run:

```bash
npm run cv:refresh
```

The importer uses `pdfplumber`/`pypdf` when available, then falls back to a
small built-in extractor. It writes:

```text
profile/candidate.raw.txt
profile/candidate.md
workspace/resume/candidate_resume.md
workspace/resume/candidate_resume.tex
```

`profile/candidate.md` is a private generated cache, not a second public
template. If your PDF is a scanned image, create `profile/candidate.md` manually
and paste your CV text there. The importer is intentionally dependency-free, so
it does not run OCR.

## Use Your Own Job Post

Create a file:

```text
jobs/first-target.md
```

Paste the job description, then run:

```bash
node src/cli.js launch --profile profile/candidate.md --job jobs/first-target.md
```

## Search Public Career Pages

For one public company career page, run:

```bash
node src/cli.js scrape --profile profile/candidate.md --source https://company.com/careers --target-currency IDR --prefer-currency USD
```

Add `--show` to print the top matches in the terminal or Codex chat while still
saving the full report:

```bash
node src/cli.js scrape --profile profile/candidate.md --source https://company.com/careers --target-currency IDR --prefer-currency USD --show
```

Use `--print` instead of `--show` only when you want the full Markdown report
printed into the terminal/chat.

For multiple real sources, copy:

```text
jobs/sources.example.txt
```

to:

```text
jobs/sources.txt
```

Put one public career URL per line, then run:

```bash
npm run scrape
```

To save the report and also print the top 5 matches:

```bash
npm run scrape:show
```

This writes a ranked shortlist to:

```text
workspace/scrape/
```

The scraper works best on readable public HTML, JobPosting structured data, and
Ashby-hosted job boards such as `https://jobs.ashbyhq.com/<company>`. Some large
job boards block automated scraping; when that happens, paste the job post into
`jobs/first-target.md` and run the normal launch workflow.

For the bundled sample only:

```bash
npm run scrape:demo
npm run scrape:demo:show
```

## Compensation Intelligence

The repo does not assume everyone wants USD. Scrape reports can keep the
original listing currency, convert to a target currency, and optionally rank
jobs that mention a preferred pay currency first.

Examples:

```bash
node src/cli.js scrape --profile profile/candidate.md --source jobs.html --target-currency IDR
node src/cli.js scrape --profile profile/candidate.md --source jobs.html --target-currency IDR --prefer-currency USD
node src/cli.js salary --company "BrightLoop" --target-currency IDR
```

Currency conversion uses local rates. Copy:

```text
salary/currency.example.json
```

to:

```text
salary/currency.json
```

Then replace the example rates with fresh rates. The private rate file is
ignored by git.

## Commands

| Command | What it does |
| --- | --- |
| `npm run launch` | End-to-end local workflow |
| `npm run import-cv` | Convert `profile/candidate.pdf` into local profile/resume drafts |
| `npm run cv:refresh` | Force-regenerate `profile/candidate.md` from the latest PDF |
| `npm run scrape` | Rank jobs and visible pay from real sources in `jobs/sources.txt` |
| `npm run scrape:show` | Save the real scrape report and print top matches |
| `npm run scrape:demo` | Run the scraper against the bundled sample job |
| `npm run scrape:demo:show` | Demo scrape with top matches printed |
| `npm run audit` | Recruiter and ATS fit audit |
| `npm run portfolio` | Portfolio proof plan |
| `npm run outreach` | LinkedIn/email outreach drafts |
| `npm run interview` | Interview objections and answer prep |
| `npm run salary` | Optional compensation benchmark with target-currency conversion |
| `npm run prompt` | Generate an AI-review prompt |
| `npm run smoke` | Verify the repo works |

## Optional AI Agent Layer

Gemini CLI OAuth and model usage limits may not work for every account. The
repo therefore works locally first and treats model calls as optional review.

For Gemini:

```bash
npm run prompt
```

Then paste `workspace/prompts/full-job-posting.md` into Gemini, AI Studio,
Antigravity, or any model interface you trust.

The repo also includes project-local Gemini CLI commands in `.gemini/commands/`
for users whose Gemini CLI setup supports them.

For Codex:

- Open the folder in Codex.
- Codex reads `AGENTS.md` for repo instructions.
- Ask Codex to run `npm run scrape`, `npm run launch`, or `npm run salary`.

The shared source of truth is still the local CLI. That keeps the workflow
usable even when a model hits a usage limit.

## Optional Compensation Benchmark

Compensation data is private and local.

Copy:

```text
salary/benchmarks.example.json
```

to:

```text
salary/benchmarks.json
```

Then replace the example ranges with your own research. The private benchmark
file is ignored by git.

Run:

```bash
node src/cli.js salary --company "BrightLoop" --target-currency IDR
```

## Privacy Defaults

These files are ignored by git:

```text
profile/candidate.md
profile/candidate.pdf
profile/candidate.raw.txt
jobs/*.md
jobs/sources.txt
salary/benchmarks.json
salary/currency.json
workspace/**/*.md
workspace/**/*.tex
workspace/**/*.pdf
```

Only examples, templates, source code, and docs are meant to be pushed.

## File Structure

```text
gemini-job-search-os/
|-- assets/gemini.gif
|-- assets/demo.svg
|-- AGENTS.md
|-- docs/
|   |-- ARCHITECTURE.md
|   `-- PUSH_CHECKLIST.md
|-- jobs/
|   |-- sources.example.txt
|   `-- TEMPLATE.md
|-- profile/
|   |-- candidate.example.md
|   |-- candidate.md        # ignored private file
|   `-- candidate.pdf       # ignored private file
|-- salary/
|   |-- README.md
|   |-- benchmarks.example.json
|   `-- currency.example.json
|-- samples/job-posting.md
|-- scripts/
|   |-- extract-pdf.py
|   |-- import-cv.js
|   |-- init.js
|   |-- smoke-test.js
|   `-- gemini-disabled.js
|-- src/
|   |-- cli.js
|   `-- core/
|       |-- currency.js
|       |-- files.js
|       |-- scoring.js
|       `-- scrape.js
|       |-- scoring.js
|       `-- scrape.js
`-- workspace/             # ignored generated outputs
```

## What Makes It Different

- Local-first, no account required for the core workflow.
- CV PDF import with generated Markdown and LaTeX-style resume draft.
- Public career page scraping and fit ranking.
- Target-currency conversion and preferred-pay-currency ranking.
- Recruiter fit audit separates keywords from proof.
- Portfolio projects are treated as first-class job-search assets.
- Outreach drafts are grounded in actual evidence.
- Optional compensation benchmarking keeps private data out of git.
- Gemini command pack and Codex instructions are included, but the repo still
  works without model auth.

## License

MIT
