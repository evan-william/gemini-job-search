const STOPWORDS = new Set([
  "the", "and", "for", "with", "that", "this", "from", "you", "your", "are",
  "our", "will", "can", "into", "using", "use", "role", "work", "team",
  "job", "have", "has", "was", "were", "but", "not", "all", "any", "of",
  "to", "in", "on", "a", "an", "or", "as", "is", "be", "by", "we", "it",
  "at", "if", "their", "they", "them", "help", "helps"
]);

const SKILL_HINTS = [
  "python", "javascript", "typescript", "sql", "react", "node", "git",
  "github", "api", "apis", "dashboard", "dashboards", "analytics", "data",
  "pandas", "machine", "learning", "ml", "ai", "llm", "llms", "rag",
  "retrieval", "embedding", "embeddings", "prompt", "prompts", "evaluation",
  "stakeholder", "stakeholders", "communication", "documentation", "csv",
  "etl", "pipeline", "pipelines", "cloud", "aws", "gcp", "azure", "product",
  "ecommerce", "support", "tickets", "survey", "reports", "automation"
];

export function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9+#]+/g, " ")
    .split(/\s+/)
    .filter((term) => term.length > 1 && !STOPWORDS.has(term));
}

export function termFrequency(text) {
  const counts = new Map();
  for (const term of tokenize(text)) {
    counts.set(term, (counts.get(term) || 0) + 1);
  }
  return counts;
}

export function extractImportantTerms(text, limit = 35) {
  const counts = termFrequency(text);
  return [...counts.entries()]
    .map(([term, count]) => ({
      term,
      count,
      hinted: SKILL_HINTS.includes(term)
    }))
    .sort((a, b) => Number(b.hinted) - Number(a.hinted) || b.count - a.count || a.term.localeCompare(b.term))
    .slice(0, limit);
}

export function analyzeFit(profile, job) {
  const profileTerms = new Set(tokenize(profile));
  const important = extractImportantTerms(job, 45);
  const matched = [];
  const missing = [];

  for (const item of important) {
    if (profileTerms.has(item.term)) matched.push(item);
    else missing.push(item);
  }

  const hintedTerms = important.filter((item) => item.hinted);
  const hintedMatched = hintedTerms.filter((item) => profileTerms.has(item.term));
  const keywordScore = important.length ? Math.round((matched.length / important.length) * 100) : 0;
  const skillScore = hintedTerms.length ? Math.round((hintedMatched.length / hintedTerms.length) * 100) : keywordScore;
  const evidenceScore = estimateEvidenceScore(profile, job);
  const overall = Math.round(keywordScore * 0.35 + skillScore * 0.35 + evidenceScore * 0.30);

  return {
    keywordScore,
    skillScore,
    evidenceScore,
    overall,
    matched,
    missing,
    recommendation: recommendation(overall)
  };
}

function estimateEvidenceScore(profile, job) {
  const proofWords = ["built", "shipped", "created", "automated", "project", "portfolio", "freelance", "internship", "github", "readme", "dashboard", "prototype"];
  const profileLower = profile.toLowerCase();
  const jobLower = job.toLowerCase();
  let score = 35;

  for (const word of proofWords) {
    if (profileLower.includes(word)) score += 5;
  }
  if (jobLower.includes("portfolio") && profileLower.includes("github")) score += 10;
  if (jobLower.includes("stakeholder") && profileLower.includes("client")) score += 10;
  return Math.max(0, Math.min(100, score));
}

function recommendation(score) {
  if (score >= 75) return "apply now";
  if (score >= 55) return "apply after targeted fixes";
  if (score >= 40) return "pause and build proof";
  return "skip unless strategic";
}

export function renderAudit({ profilePath, jobPath, profile, job, date }) {
  const fit = analyzeFit(profile, job);
  const topMatched = fit.matched.slice(0, 14).map((x) => formatTerm(x.term));
  const topMissing = fit.missing.slice(0, 14).map((x) => formatTerm(x.term));

  return `# Recruiter Fit Audit

Date: ${date}

Profile: ${profilePath}
Job: ${jobPath}

## Decision

Recommendation: **${fit.recommendation}**

Overall score: **${fit.overall}/100**

| Dimension | Score |
| --- | ---: |
| Keyword overlap | ${fit.keywordScore}/100 |
| Skill signal | ${fit.skillScore}/100 |
| Evidence strength | ${fit.evidenceScore}/100 |

## Matched Signals

${bulletList(topMatched)}

## Missing or Weak Signals

${bulletList(topMissing)}

## Recruiter Read

The candidate has visible signal for ${sentenceList(topMatched.slice(0, 5))}.
The biggest risk is missing or under-proven signal around ${sentenceList(topMissing.slice(0, 5))}.

## Fix Before Applying

${bulletList([
    `Add one resume bullet or portfolio note that proves ${topMissing[0] || "the highest-priority missing skill"}.`,
    `Mirror the job language for ${topMissing[1] || "the target role"} only if the profile has real evidence.`,
    "Prepare a short explanation for every adjacent skill so the interview does not expose inflated claims.",
    "Use the outreach draft only after adding one concrete proof link."
  ])}

## Honesty Check

Do not claim direct experience with terms in the missing list unless the profile
actually contains proof. Adjacent experience is fine. Fabricated experience is not.
`;
}

export function renderPortfolioPlan({ profilePath, jobPath, profile, job, date }) {
  const fit = analyzeFit(profile, job);
  const gaps = fit.missing.slice(0, 6).map((x) => formatTerm(x.term));
  const role = inferRole(job);
  const projects = [
    {
      title: `${titleCase(role)} Signal Dashboard`,
      gap: gaps[0] || "dashboard",
      artifact: "A GitHub repo with a README, sample dataset, screenshots, and a short Loom-style demo script."
    },
    {
      title: "Messy Data to Insight Report",
      gap: gaps[1] || "data cleaning",
      artifact: "Before/after dataset, analysis notebook, and a one-page stakeholder report."
    },
    {
      title: "LLM Evaluation Notebook",
      gap: gaps[2] || "evaluation",
      artifact: "Prompt variants, test cases, failure examples, and a scoring table."
    }
  ];

  return `# Portfolio Proof Plan

Date: ${date}

Profile: ${profilePath}
Job: ${jobPath}

## Goal

Create proof for the highest-risk gaps before applying or before the first
interview. Keep each project small enough to finish quickly.

${projects.map((project, index) => renderProject(project, index + 1)).join("\n")}

## README Template

${bulletList([
    "Problem: what business/user problem this solves.",
    "Data/input: what the project consumes.",
    "Approach: tools, model prompts, evaluation method.",
    "Demo: screenshots or CLI output.",
    "Limitations: what fails and what you would improve.",
    "Role relevance: one paragraph mapping the project to the target job."
  ])}
`;
}

function renderProject(project, index) {
  return `## ${index}. ${project.title}

Proof gap: **${project.gap}**

3-day scope:

${bulletList([
    "Build the smallest working version.",
    "Use sample or public-safe data.",
    "Write a README that explains the tradeoffs."
  ])}

7-day scope:

${bulletList([
    "Add evaluation examples.",
    "Add screenshots or terminal output.",
    "Add a short retrospective with limitations."
  ])}

Artifact: ${project.artifact}

Honest claim unlocked: "I built a small project that demonstrates ${project.gap}
in a realistic workflow."
`;
}

export function renderOutreach({ profilePath, jobPath, profile, job, date }) {
  const fit = analyzeFit(profile, job);
  const matched = fit.matched.slice(0, 4).map((x) => formatTerm(x.term));
  const role = inferRole(job);
  const company = inferCompany(job);
  const proof = chooseProofTerm(matched) || "a relevant project";

  return `# Outreach Drafts

Date: ${date}

Profile: ${profilePath}
Job: ${jobPath}

## Positioning

Early-career candidate with proof around ${sentenceList(matched)} for a ${role}
role at ${company}.

## LinkedIn Connection Request

Hi, I saw the ${role} opening at ${company}. I have been building small AI/data
tools around ${proof} and would value following your work.

## Follow-up DM

Thanks for connecting. I noticed ${company} is hiring for ${role}. My strongest
match is hands-on work around ${sentenceList(matched.slice(0, 3))}. I am not
trying to pitch blindly, I am checking whether this role values small shipped
proof over years of title experience. If useful, I can send a short portfolio
link and a 3-bullet fit summary.

## Email

Subject: ${titleCase(role)} candidate with ${proof} proof

Hi,

I am interested in the ${role} role at ${company}. My background is early-career,
but I have practical proof around ${sentenceList(matched.slice(0, 3))}, including
small shipped tools and documentation.

The role stood out because it appears to need someone who can connect data,
AI workflows, and clear stakeholder communication. I would be glad to share a
short portfolio link and a concise fit summary.

Best,
Alex

## Do Not Send Until

${bulletList([
    "The portfolio link is real.",
    "The resume contains the same proof point.",
    "The message is customized with the real recipient or team."
  ])}
`;
}

export function renderInterviewPack({ profilePath, jobPath, profile, job, date }) {
  const fit = analyzeFit(profile, job);
  const matched = fit.matched.slice(0, 6).map((x) => formatTerm(x.term));
  const gaps = fit.missing.slice(0, 6).map((x) => formatTerm(x.term));
  const interviewSkill = chooseProofTerm(matched) || "an AI workflow";

  return `# Interview Simulator Pack

Date: ${date}

Profile: ${profilePath}
Job: ${jobPath}

## Likely Questions

${numberedList([
    `Walk me through a project where you used ${interviewSkill} to solve a real problem.`,
    "How do you evaluate whether an AI output is good enough?",
    "Tell me about a time you cleaned messy data.",
    "How would you explain a technical finding to a non-technical stakeholder?",
    `What would you do in your first week in this role?`,
    `Where are you weakest against this job description?`,
    "Show me a project that proves you can ship independently.",
    "How do you document limitations or failure cases?",
    "Why this company and not a generic AI role?",
    "What do you need from a manager to ramp up quickly?"
  ])}

## Objections To Prepare For

${bulletList(gaps.map((gap) => `Limited visible proof for ${gap}. Prepare an honest adjacent example or build a small portfolio artifact.`))}

## STAR Answer Seeds

${bulletList([
    "Situation: a messy dataset, unclear client request, or ambiguous project brief.",
    "Task: turn it into a usable workflow or insight.",
    "Action: cleaning, prototyping, documenting, testing, asking clarifying questions.",
    "Result: shipped tool, clearer report, reusable README, or faster workflow."
  ])}

## Closing Pitch

I am early-career, but I have already built practical tools around
${sentenceList(matched.slice(0, 4))}. I am strongest when the work needs someone
who can learn quickly, document clearly, and turn messy inputs into useful
outputs. I would ramp fastest with concrete problems, feedback, and access to
real user examples.
`;
}

export function renderPrompt({ workflow, profile, job }) {
  const title = workflow === "full" ? "Full Job Search OS Pipeline" : `${titleCase(workflow)} Workflow`;
  return `# ${title}

Candidate profile:

\`\`\`text
${profile.trim()}
\`\`\`

Job posting:

\`\`\`text
${job.trim()}
\`\`\`

Run the ${workflow} workflow from this repository. Be specific, honest, and
ground every claim in the provided inputs. If evidence is missing, say what proof
the candidate should build instead of pretending it exists.
`;
}

function inferCompany(job) {
  const match = job.match(/company:\s*(.+)/i);
  return match ? match[1].trim() : "the company";
}

function inferRole(job) {
  const heading = job.match(/^#\s*(.+)$/m);
  if (heading) return heading[1].replace(/^sample job posting:\s*/i, "").trim();
  const role = job.match(/role:\s*(.+)/i);
  return role ? role[1].trim() : "target role";
}

function bulletList(items) {
  const clean = items.filter(Boolean);
  return clean.length ? clean.map((item) => `- ${item}`).join("\n") : "- No strong signal found.";
}

function numberedList(items) {
  return items.map((item, index) => `${index + 1}. ${item}`).join("\n");
}

function sentenceList(items) {
  const clean = items.filter(Boolean);
  if (clean.length === 0) return "the target skills";
  if (clean.length === 1) return clean[0];
  return `${clean.slice(0, -1).join(", ")} and ${clean.at(-1)}`;
}

function titleCase(input) {
  return input
    .split(/\s+/)
    .map((word) => word ? word[0].toUpperCase() + word.slice(1) : "")
    .join(" ");
}

function chooseProofTerm(items) {
  const priority = ["AI", "RAG", "embeddings", "prompt engineering", "Python", "JavaScript", "SQL", "data", "evaluation", "GitHub"];
  return priority.find((term) => items.includes(term)) || items.find((term) => term.length > 2);
}

function formatTerm(term) {
  const labels = {
    ai: "AI",
    ml: "ML",
    llm: "LLM",
    llms: "LLMs",
    rag: "RAG",
    sql: "SQL",
    csv: "CSV",
    api: "API",
    apis: "APIs",
    github: "GitHub",
    javascript: "JavaScript",
    python: "Python",
    ecommerce: "ecommerce",
    support: "customer support",
    prompt: "prompt engineering",
    prompts: "prompt engineering",
    analytics: "analytics"
  };
  return labels[term] || term;
}
