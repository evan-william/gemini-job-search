# Push Checklist

Run before the first GitHub push:

```bash
npm run smoke
git status --ignored --short
```

Safe-to-push files should show as `??`.

Private files should show as `!!`, including:

```text
profile/candidate.md
profile/candidate.pdf
profile/candidate.raw.txt
jobs/first-target.md
jobs/sources.txt
jobs/search.config.json
salary/benchmarks.json
salary/currency.json
salary/display.json
workspace/audits/*.md
workspace/portfolio/*.md
workspace/outreach/*.md
workspace/interviews/*.md
workspace/prompts/*.md
workspace/scrape/*.md
workspace/scrape/*.json
workspace/resume/*.md
workspace/resume/*.tex
```

Do not push real resumes, phone numbers, addresses, private salary research, or
real job applications.
