# Architecture

Gemini Job Search OS has two layers.

## Local Layer

The local layer is deterministic and uses no model calls.

- imports `profile/candidate.pdf` into local profile Markdown when possible
- uses `pdfplumber`/`pypdf` first and a built-in Node fallback second
- reads `profile/candidate.md` as the private generated profile cache
- reads job Markdown
- discovers jobs from public job APIs, company boards, and optional source files
- writes the raw scrape collection before ranking
- supports public HTML, JobPosting JSON-LD, Ashby, Greenhouse, and Lever boards
- detects visible compensation ranges and converts them with local rates
- uses local display currency preferences for primary and secondary pay output
- extracts normalized terms
- calculates overlap and missing terms
- generates audit, portfolio, outreach, scrape, salary, and interview drafts

This makes the repo demoable for anyone who clones it.

## AI Review Layer

The model layer is prompt-driven and optional.

- `prompts/*.md` contains reusable agent prompts
- `GEMINI.md` gives project-level rules for Gemini-style agents
- `AGENTS.md` gives project-level rules for Codex
- `workspace/prompts/` contains generated prompts users can paste into their
  preferred model interface

The review layer can improve judgment and language, while the local layer keeps
the workflow explainable, token-efficient, and runnable without auth.

## Why Not Auto-Apply?

Auto-apply tools can create spam, violate site terms, and send low-quality
applications. This repo focuses on decision quality and evidence quality before
the user applies manually.

## Data Flow

```text
profile/candidate.pdf (local, ignored)
      |
      v
scripts/import-cv.js
      |
      v
profile/candidate.md (local generated cache, ignored)
profile/candidate.example.md (public demo fallback)
jobs/*.md
jobs/search.config.json
jobs/sources.txt
      |
      v
src/core/scrape.js
      |
      +-- workspace/scrape/scrape-results.json
      +-- workspace/scrape/ranked-matches.md
      |
      v
src/core/scoring.js
      |
      +-- workspace/audits/
      +-- workspace/portfolio/
      +-- workspace/outreach/
      +-- workspace/interviews/
      +-- workspace/prompts/

salary/currency.example.json
salary/display.example.json
      |
      v
src/core/currency.js
      |
      +-- converted pay ranges in scrape and salary reports
```
