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

For your own job post:

```text
jobs/first-target.md
```

Then:

```bash
node src/cli.js launch --profile profile/candidate.md --job jobs/first-target.md
```

For one public career page:

```bash
node src/cli.js scrape --profile profile/candidate.md --source https://company.com/careers --target-currency IDR --prefer-currency USD
```

For multiple sources, copy `jobs/sources.example.txt` to `jobs/sources.txt`,
add real career page URLs, then run:

```bash
npm run scrape
```

To show the top matches in the terminal/chat too:

```bash
npm run scrape:show
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
