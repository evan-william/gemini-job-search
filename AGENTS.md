# Codex Project Instructions

This repository is a local-first job search operating system. Help the user
make better job-search decisions, not spam applications.

## Privacy

- Never suggest committing `profile/candidate.md`, `profile/candidate.pdf`,
  private job posts, private salary data, or generated workspace reports.
- Treat `salary/benchmarks.json` and `salary/currency.json` as private local
  decision data.
- Do not invent credentials, employers, metrics, degrees, certifications, or
  references.

## Token Budget

- Run local scripts first. Use model reasoning only for review, critique, and
  judgment after the deterministic outputs exist.
- Prefer `npm run scrape`, `npm run launch`, `npm run salary`, and
  `npm run smoke` before asking the model to re-analyze raw inputs.
- For broad job pages, rank locally first and only inspect the top matches.
- Summarize generated reports instead of pasting entire CVs, PDFs, or scrape
  outputs back into the chat.
- Keep model prompts grounded in the smallest useful input: candidate summary,
  target job, top gaps, visible compensation, and decision question.

## Commands

```bash
npm run launch
npm run cv:refresh
npm run scrape
npm run scrape:show
npm run scrape:demo
npm run salary
npm run smoke
node src/cli.js scrape --profile profile/candidate.md --source <url-or-file> --target-currency IDR --prefer-currency USD --show
node src/cli.js launch --profile profile/candidate.md --job jobs/first-target.md
node src/cli.js salary --company "BrightLoop" --target-currency IDR
```

Run `npm run cv:refresh` after the user replaces `profile/candidate.pdf`.

## Codex Usage

Codex does not use `.gemini/commands` as repo-local slash commands. Those files
are for Gemini CLI users. In Codex, run the npm scripts directly or ask Codex in
plain language, for example: "run scrape for https://company.com/careers with
target currency IDR and prefer USD". Do not use the bundled sample as real
scraping unless the user explicitly asks for the demo.

When the user wants results visible in the chat, add `--show` or run
`npm run scrape:show`. Use `--print` only when they ask for the full markdown
report in the chat.

If reusable Codex slash commands are needed, use Codex skills or local custom
prompts in the user's Codex home. Keep this repo shareable by making the npm
scripts the source of truth.

## Quality Bar

- Fit reports separate keyword overlap, skill signal, and evidence strength.
- Scrape reports include visible compensation when present and target-currency
  conversion when requested.
- Treat `npm run scrape:demo` and `samples/job-posting.md` as demo-only. For
  real scraping, use `jobs/sources.txt` or a concrete `--source` URL.
- Salary reports keep original currency and add approximate conversion only when
  a target currency is provided.
- Outreach must be short, specific, and grounded in real evidence.
- Interview prep should use actual experience and explicit gaps.
