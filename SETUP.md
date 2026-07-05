# Setup

## One Command

```bash
npm run launch
```

That initializes local files, imports `profile/candidate.pdf` if present, and
writes all workflow outputs under `workspace/`.

Without a private PDF, the repo uses `profile/candidate.example.md` so a fresh
clone still demos correctly.

After replacing `profile/candidate.pdf`, force-refresh the generated Markdown:

```bash
npm run cv:refresh
```

## CV Input

Main input:

```text
profile/candidate.pdf
```

Generated/private fallback:

```text
profile/candidate.md
```

`profile/candidate.md` is created from a text-based PDF when possible. It is
only for local use and is ignored by git. The importer uses `pdfplumber`/`pypdf`
when available, then falls back to a built-in extractor. If the PDF is scanned,
create `profile/candidate.md` manually and paste your CV text there.

## Job Input

Paste a job post into:

```text
jobs/first-target.md
```

Run:

```bash
node src/cli.js launch --profile profile/candidate.md --job jobs/first-target.md
```

## Salary Benchmark

Copy:

```text
salary/benchmarks.example.json
```

to:

```text
salary/benchmarks.json
```

Then run:

```bash
npm run salary
```

`salary/benchmarks.json` is ignored by git.

For currency conversion, copy:

```text
salary/currency.example.json
```

to:

```text
salary/currency.json
```

Then run with a target currency:

```bash
node src/cli.js salary --company "BrightLoop" --target-currency IDR
```

`salary/currency.json` is ignored by git.

For display currency preferences, copy:

```text
salary/display.example.json
```

to:

```text
salary/display.json
```

or run:

```bash
npm run currency:show
npm run change_currency:idr
npm run change_currency:eur
npm run change_currency:sgd
npm run change_currency -- THB
```

`salary/display.json` is ignored by git. Scrape output keeps the original
listing currency and adds the configured primary/secondary display currencies
when conversion is possible.

## Public Job Discovery

Collect jobs from public providers and company boards, then rank them against
your profile:

```bash
npm run scrape
```

Raw collected jobs are written to:

```text
workspace/scrape/scrape-results.json
```

Ranked matches are written to:

```text
workspace/scrape/ranked-matches.md
```

Print the ranked shortlist directly:

```bash
npm run scrape:show:best
npm run scrape:show:2
npm run scrape:show:8
npm run scrape:10
npm run scrape:show:50
```

Copy `jobs/search.config.example.json` to `jobs/search.config.json` to change
target roles, locations, providers, and boards. Copy `jobs/sources.example.txt`
to `jobs/sources.txt` for extra company career pages.

For board-only discovery:

```bash
npm run scrape:boards
npm run scrape:boards:8
npm run scrape:boards:50
```

Use `--target-currency` to compare pay in your local currency and
`--prefer-currency` to rank jobs that list a preferred pay currency first.

## Push Safety

Before pushing:

```bash
git status --ignored --short
npm run smoke
```

Private files should appear with `!!`, not `??`.
