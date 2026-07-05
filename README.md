<p align="center">
  <img src="assets/gemini.gif" alt="Gemini Job Search OS logo" width="132">
</p>

# Gemini Job Search OS

An open-source career radar that turns your CV into ranked job targets,
evidence gaps, portfolio moves, outreach drafts, and interview prep.

Built local-first for [Gemini CLI](https://github.com/google-gemini/gemini-cli)
and [Codex](https://openai.com/codex/), with public-board discovery for
[Ashby](https://www.ashbyhq.com/), [Greenhouse](https://www.greenhouse.com/),
[Lever](https://www.lever.co/), and readable job APIs.

Drop in `candidate.pdf`, run discovery, and get a shortlist that tells you what
to apply to, what to skip, and what proof you still need before reaching out.

```bash
npm run launch
```

<p align="center">
  <a href="#discover-jobs-across-sources"><strong><u>Discover jobs</u></strong></a>
  ·
  <a href="#use-your-own-cv"><strong><u>Import your CV</u></strong></a>
  ·
  <a href="#compensation-intelligence"><strong><u>Currency-aware pay</u></strong></a>
  ·
  <a href="#optional-ai-agent-layer"><strong><u>Gemini + Codex</u></strong></a>
</p>

## What This Is

Most AI job tools start at the resume. This starts earlier: deciding whether a
role is worth your time.

It scans public sources, ranks openings against your private profile, converts
visible pay into your display currencies, and then helps you build the missing
evidence before you apply.

```text
profile/candidate.pdf
                 +
        public job sources
                 |
                 v
 CV import -> job discovery -> ranked shortlist -> proof gap map
                 |              |               |
                 v              v               v
          private profile   outreach       interview prep
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

## Discover Jobs Across Sources

Run broad discovery:

```bash
npm run scrape
```

That collects jobs from configured public providers and company boards, writes
the raw collection, then ranks the roles against your profile.

Outputs:

```text
workspace/scrape/scrape-results.json
workspace/scrape/ranked-matches.md
```

Choose how many ranked matches to print in the terminal or Codex chat:

```bash
npm run scrape:show:best  # top 1
npm run scrape:show:2     # top 2
npm run scrape:show:7     # top 7
npm run scrape:show:8     # top 8
npm run scrape:10         # top 10
npm run scrape:show:25    # top 25
npm run scrape:show:50    # top 50
```

`npm run scrape` and `npm run scrape:show` both print the top 10 by default.
Every counted `show` command also writes a chat-ready copy such as
`workspace/scrape/top-25.md` or `workspace/scrape/openai-top-10.md`.

To customize discovery, copy:

```text
jobs/search.config.example.json
```

to:

```text
jobs/search.config.json
```

Then edit your target roles, locations, providers, and boards. The private
config is ignored by git.

You can also add company boards to:

```text
jobs/sources.txt
```

Then run board-only discovery:

```bash
npm run scrape:boards       # top 10
npm run scrape:boards:best  # top 1
npm run scrape:boards:2     # top 2
npm run scrape:boards:8     # top 8
npm run scrape:boards:50    # top 50
```

Supported source types include public job APIs, readable public HTML,
JobPosting structured data, Ashby, Greenhouse, and Lever boards.

For one specific public company career page:

```bash
node src/cli.js scrape --profile profile/candidate.md --source https://company.com/careers --target-currency IDR --prefer-currency USD --show
```

Use `--print` instead of `--show` only when you want the full Markdown report
printed into the terminal/chat.

Some large job boards block automated scraping or prohibit it in their terms.
Use their official APIs, public company career pages, or saved job posts instead
of forcing blocked pages.

For the bundled sample only:

```bash
npm run scrape:demo
npm run scrape:demo:show
```

## Compensation Intelligence

The repo does not assume everyone wants USD. Scrape reports keep the original
listing currency, then show your primary and secondary display currencies when
conversion is possible.

Default display:

```text
Primary currency: USD
Secondary currency: IDR
Preferred pay currency: USD
```

Change the secondary display currency:

```bash
npm run change_currency:idr
npm run change_currency:eur
npm run change_currency:sgd
npm run change_currency:jpy
npm run change_currency -- THB
```

Show or list supported currencies:

```bash
npm run currency:show
npm run currency:list
```

Supported aliases include:

```text
usd, idr, eur, gbp, sgd, aud, cad, chf, cny, hkd, jpy, krw,
inr, myr, nzd, php, thb, vnd, aed, sar, brl, mxn
```

After changing currency, all scrape commands use the new display automatically:

```bash
npm run scrape:show:10
npm run scrape:boards:10
```

Examples:

```bash
node src/cli.js scrape --profile profile/candidate.md --source jobs.html --target-currency USD --secondary-currency IDR
node src/cli.js scrape --profile profile/candidate.md --source jobs.html --target-currency USD --secondary-currency EUR --prefer-currency USD
node src/cli.js salary --company "BrightLoop" --target-currency IDR
```

Currency display preferences are local. Copy:

```text
salary/display.example.json
```

to:

```text
salary/display.json
```

or use the `change_currency:*` commands. Currency conversion uses local rates.
Copy:

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
| `npm run currency:show` | Show primary, secondary, and preferred pay currencies |
| `npm run change_currency:idr` | Set secondary display currency to IDR |
| `npm run change_currency:eur` | Set secondary display currency to EUR |
| `npm run change_currency -- THB` | Set secondary display currency to any supported code |
| `npm run scrape` | Discover jobs across public providers/boards and print top 10 |
| `npm run scrape:show:best` | Discover jobs and print top 1 |
| `npm run scrape:show:2` | Discover jobs and print top 2 |
| `npm run scrape:show:8` | Discover jobs and print top 8 |
| `npm run scrape:10` | Discover jobs and print top 10 |
| `npm run scrape:show:50` | Discover jobs and print top 50 |
| `npm run scrape:boards` | Rank company boards from `jobs/sources.txt` and print top 10 |
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
gemini
```

Project-local slash commands mirror the npm scripts:

```text
/scrape
/scrape:best
/scrape:2
/scrape:10
/scrape:25
/scrape:50
/scrape:show:best
/scrape:show:2
/scrape:show:50
/scrape:boards
/scrape:boards:2
/scrape:boards:50
/scrape:demo
/scrape:demo:show
/currency
/currency:list
/change_currency:idr
/change_currency:eur
/change_currency:sgd
/change_currency:thb
/change_currency:mxn
/setup:cv
```

These commands tell Gemini CLI to run the same local npm scripts Codex uses.
The local CLI remains the source of truth, so Gemini spends tokens reviewing
results instead of re-scraping or re-ranking in the model.

If your Gemini CLI setup does not load project slash commands, run the same npm
scripts directly and paste `workspace/prompts/full-job-posting.md` into Gemini,
AI Studio, Antigravity, or any model interface you trust.

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
jobs/search.config.json
salary/benchmarks.json
salary/currency.json
salary/display.json
workspace/**/*.md
workspace/**/*.tex
workspace/**/*.pdf
workspace/**/*.json
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
|   |-- search.config.example.json
|   |-- sources.example.txt
|   `-- TEMPLATE.md
|-- profile/
|   |-- candidate.example.md
|   |-- candidate.md        # ignored private file
|   `-- candidate.pdf       # ignored private file
|-- salary/
|   |-- README.md
|   |-- benchmarks.example.json
|   |-- currency.example.json
|   `-- display.example.json
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
