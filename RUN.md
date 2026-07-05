# Run

```bash
npm run launch
```

Fresh clones use `profile/candidate.example.md` as demo data. Add
`profile/candidate.pdf` for real results.

Open the generated files:

```text
workspace/audits/job-posting.md
workspace/portfolio/job-posting.md
workspace/outreach/job-posting.md
workspace/interviews/job-posting.md
workspace/prompts/full-job-posting.md
workspace/scrape/job-posting.md
```

For your own CV:

```text
profile/candidate.pdf
```

After replacing the PDF:

```bash
npm run cv:refresh
```

For display currency:

```bash
npm run currency:show
npm run change_currency:idr
npm run change_currency:eur
npm run change_currency -- THB
```

All scrape commands use the current display currency settings.

For your own job post:

```text
jobs/first-target.md
```

Then:

```bash
node src/cli.js launch --profile profile/candidate.md --job jobs/first-target.md
```

For broad job discovery across configured public providers and company boards:

```bash
npm run scrape
```

This writes:

```text
workspace/scrape/scrape-results.json
workspace/scrape/ranked-matches.md
```

Choose how many ranked matches to print in the terminal/chat:

```bash
npm run scrape:show:best
npm run scrape:show:2
npm run scrape:show:7
npm run scrape:show:8
npm run scrape:10
npm run scrape:show:25
npm run scrape:show:50
```

For company-board-only scraping, copy `jobs/sources.example.txt` to
`jobs/sources.txt`, add real career page URLs, then run:

```bash
npm run scrape:boards
npm run scrape:boards:2
npm run scrape:boards:8
npm run scrape:boards:50
```

For one public career page:

```bash
node src/cli.js scrape --profile profile/candidate.md --source https://company.com/careers --target-currency IDR --prefer-currency USD --show
```

For the bundled sample only:

```bash
npm run scrape:demo
npm run scrape:demo:show
```

For compensation conversion:

```bash
node src/cli.js salary --company "BrightLoop" --target-currency IDR
```
