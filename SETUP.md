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

## Public Job Search

Rank public career-page jobs against your profile:

```bash
node src/cli.js scrape --profile profile/candidate.md --source https://company.com/careers --target-currency IDR --prefer-currency USD
```

Or copy `jobs/sources.example.txt` to `jobs/sources.txt`, add one real source
per line, then run:

```bash
npm run scrape
```

Use this when you want the ranked jobs printed in the terminal or Codex chat:

```bash
npm run scrape:show
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
