import { access, copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { inflateSync } from "node:zlib";

const pdfPath = "profile/candidate.pdf";
const rawPath = "profile/candidate.raw.txt";
const profilePath = "profile/candidate.md";
const resumeMdPath = "workspace/resume/candidate_resume.md";
const resumeTexPath = "workspace/resume/candidate_resume.tex";
const args = new Set(process.argv.slice(2));
const force = args.has("--force");
const keep = args.has("--keep");

try {
  await access(pdfPath);
} catch {
  console.log("No profile/candidate.pdf found. Skipping CV import.");
  process.exit(0);
}

await mkdir("profile", { recursive: true });
await mkdir("workspace/resume", { recursive: true });

const pdf = await readFile(pdfPath);
const pdfHash = createHash("sha256").update(pdf).digest("hex");
const extraction = await extractPdfTextBest(pdfPath, pdf);
const text = normalizeExtractedText(extraction.text);

if (text.length < 80) {
  console.log("Found profile/candidate.pdf, but could not extract enough text.");
  console.log("If this is a scanned PDF, create profile/candidate.md manually or run OCR first.");
  if (extraction.errors?.length) {
    console.log(`Extractor notes: ${extraction.errors.join(" | ")}`);
  }
  process.exit(0);
}

if (keep && await exists(profilePath)) {
  console.log(`Kept existing ${profilePath} because --keep was provided.`);
  process.exit(0);
}

await backupManualProfileIfNeeded(profilePath);
await writeText(rawPath, text + "\n");
await writeText(profilePath, buildProfile({ text, pdfHash, extractor: extraction.extractor }));
await writeText(resumeMdPath, buildResumeMarkdown({ text, pdfHash, extractor: extraction.extractor }));
await writeText(resumeTexPath, buildResumeTex(text));

console.log(`Imported ${pdfPath} with ${extraction.extractor}.`);
console.log(`PDF SHA256: ${pdfHash.slice(0, 12)}...`);
console.log(`Wrote ${rawPath}`);
console.log(`Wrote ${profilePath}`);
console.log(`Wrote ${resumeMdPath}`);
console.log(`Wrote ${resumeTexPath}`);

async function extractPdfTextBest(path, buffer) {
  const pythonResult = await extractWithPython(path);
  if (pythonResult.text?.trim().length >= 80) return pythonResult;

  const fallbackText = extractPdfTextFallback(buffer);
  if (fallbackText.trim().length >= 80) {
    return {
      extractor: "node-fallback",
      text: fallbackText,
      errors: pythonResult.errors || []
    };
  }

  return {
    extractor: "none",
    text: fallbackText,
    errors: pythonResult.errors || ["node-fallback: extracted too little text"]
  };
}

async function extractWithPython(path) {
  const candidates = pythonCandidates();
  const script = "scripts/extract-pdf.py";
  const errors = [];

  for (const python of candidates) {
    try {
      const result = await run(python, [script, path], {
        PYTHONIOENCODING: "utf-8"
      });
      const payload = JSON.parse(result.stdout || "{}");
      if (payload.text?.trim().length >= 80) {
        return { extractor: payload.extractor || `python:${python}`, text: payload.text };
      }
      errors.push(...(payload.errors || [`${python}: extracted too little text`]));
    } catch (error) {
      errors.push(`${python}: ${error.message}`);
    }
  }

  return { extractor: "none", text: "", errors };
}

function pythonCandidates() {
  const found = new Set();
  const candidates = [];
  const add = (value) => {
    if (value && !found.has(value)) {
      found.add(value);
      candidates.push(value);
    }
  };

  add(process.env.PYTHON);
  add(join(homedir(), ".cache", "codex-runtimes", "codex-primary-runtime", "dependencies", "python", "python.exe"));
  add("python");
  add("python3");
  add("py");
  return candidates;
}

function run(command, argv, extraEnv = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, argv, {
      env: { ...process.env, ...extraEnv },
      windowsHide: true
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(stderr.trim() || `${command} exited with code ${code}`));
    });
  });
}

async function backupManualProfileIfNeeded(path) {
  if (!await exists(path)) return;
  const current = await readFile(path, "utf8");
  if (!current.trim() || isGeneratedProfile(current) || isExampleProfile(current)) return;
  if (!force) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupPath = `profile/candidate.backup-${timestamp}.md`;
    await copyFile(path, backupPath);
    console.log(`Backed up existing manual profile to ${backupPath}`);
  }
}

function isGeneratedProfile(text) {
  return /Generated by gemini-job-search-os import-cv/i.test(text)
    || /Generated from profile\/candidate\.pdf/i.test(text);
}

function isExampleProfile(text) {
  return /# Candidate Profile Example/i.test(text)
    || /public-safe example/i.test(text);
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function writeText(path, text) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, text, "utf8");
}

function normalizeExtractedText(text) {
  const cleaned = text
    .replace(/\r/g, "\n")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\uF0B7/g, "\n")
    .replace(/[•▪◦]/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n");

  return joinWrappedLines(cleaned
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean))
    .join("\n");
}

function joinWrappedLines(lines) {
  const output = [];
  for (const line of lines) {
  if (!output.length || shouldStartNewLine(output.at(-1), line)) {
      output.push(line);
    } else {
      output[output.length - 1] = `${output.at(-1)} ${line}`;
    }
  }
  return output;
}

function shouldStartNewLine(previous, line) {
  if (/@/.test(line) || /\+?\d[\d\s().-]{7,}/.test(line)) return true;
  if (/^[A-Z][A-Za-z .'-]+,\s*[A-Z][A-Za-z .'-]+$/.test(line)) return true;
  if (isSectionHeading(line)) return true;
  if (isSectionHeading(previous)) return true;
  if (/^(Sophistec|Widya|NASA|Festival|Languages:|Technical Skills:|Tech Stack:|Activities:)/i.test(line)) return true;
  if (/\b(Remote|Present|20\d{2}|January|February|March|April|May|June|July|August|September|October|November|December)\b/i.test(line)) return true;
  if (/^[A-Z][A-Za-z .&()/-]+:\s/.test(line)) return true;
  if (/[.!?)]$/.test(previous)) return true;
  return false;
}

function isSectionHeading(line) {
  return /^(WORK EXPERIENCE|EDUCATION|HONORS & PROJECTS|PROJECTS|OTHER INFORMATION|SKILLS|EXPERIENCE)$/i.test(line);
}

function buildProfile({ text, pdfHash, extractor }) {
  const lines = text.split("\n").filter(Boolean);
  const sections = splitSections(lines);
  const identity = sections.Identity || lines.slice(0, 4);
  const name = identity[0] || "Candidate";
  const skills = lines.filter((line) => /python|javascript|sql|react|ai|machine|data|cloud|aws|excel|tableau|power bi|llm|rag|prompt|php|fastapi|flask|postgres|mysql|scikit|pandas|numpy/i.test(line));
  const experience = lines.filter((line) => /\b(built|created|developed|managed|led|worked|intern|engineer|analyst|developer|assistant|project|architected|optimized|directed|executed|produced)\b/i.test(line));

  return `# Candidate Profile

<!-- Generated by gemini-job-search-os import-cv. Source: profile/candidate.pdf. SHA256: ${pdfHash}. Extractor: ${extractor}. Imported: ${new Date().toISOString()}. -->

## Identity

- Name: ${name}
${toBullets(identity.slice(1))}

## Work Experience

${toBullets(sections["WORK EXPERIENCE"] || [])}

## Education

${toBullets(sections.EDUCATION || [])}

## Honors and Projects

${toBullets(sections["HONORS & PROJECTS"] || sections.PROJECTS || [])}

## Other Information

${toBullets(sections["OTHER INFORMATION"] || [])}

## Extracted Skills and Signals

${toBullets(unique(skills).slice(0, 24))}

## Extracted Experience Signals

${toBullets(unique(experience).slice(0, 24))}

## Raw CV Text

\`\`\`text
${text}
\`\`\`
`;
}

function splitSections(lines) {
  const sections = { Identity: [] };
  let current = "Identity";
  for (const line of lines) {
    if (isSectionHeading(line)) {
      current = line.toUpperCase();
      sections[current] = [];
      continue;
    }
    sections[current] ??= [];
    sections[current].push(line);
  }
  return sections;
}

function buildResumeMarkdown({ text, pdfHash, extractor }) {
  return `# Resume Draft

Generated from \`profile/candidate.pdf\` by ${extractor}.

PDF SHA256: \`${pdfHash}\`

Review and edit before sending.

## Extracted CV Text

\`\`\`text
${text}
\`\`\`
`;
}

function buildResumeTex(text) {
  const safe = escapeLatex(text).split("\n").slice(0, 100).join("\\\\\n");
  return `\\documentclass[11pt]{article}
\\usepackage[margin=0.75in]{geometry}
\\usepackage[hidelinks]{hyperref}
\\begin{document}
\\section*{Resume Draft}
Generated from \\texttt{profile/candidate.pdf}. Review before sending.

\\bigskip
${safe}

\\end{document}
`;
}

function toBullets(items) {
  const clean = items.filter(Boolean);
  return clean.length ? clean.map((item) => `- ${item}`).join("\n") : "- Not found in CV extraction.";
}

function unique(items) {
  return [...new Set(items.map((item) => item.trim()).filter(Boolean))];
}

function extractPdfTextFallback(buffer) {
  const binary = buffer.toString("latin1");
  const chunks = [];
  const streamRegex = /<<(.*?)>>\s*stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match;

  while ((match = streamRegex.exec(binary)) !== null) {
    const dict = match[1];
    const raw = Buffer.from(match[2], "latin1");
    let data = raw;
    if (/FlateDecode/.test(dict)) {
      try {
        data = inflateSync(raw);
      } catch {
        continue;
      }
    }
    chunks.push(extractTextOperators(data.toString("latin1")));
  }

  if (chunks.join("").trim().length < 80) {
    chunks.push(extractTextOperators(binary));
  }

  return chunks.join("\n");
}

function extractTextOperators(content) {
  const out = [];
  const stringRegex = /\((?:\\.|[^\\)])*\)\s*Tj|\[(.*?)\]\s*TJ/g;
  let match;
  while ((match = stringRegex.exec(content)) !== null) {
    if (match[0].endsWith("Tj")) {
      out.push(decodePdfString(match[0].replace(/\s*Tj$/, "")));
    } else if (match[1]) {
      const parts = [...match[1].matchAll(/\((?:\\.|[^\\)])*\)/g)].map((m) => decodePdfString(m[0]));
      out.push(parts.join(""));
    }
  }
  return out.join("\n");
}

function decodePdfString(token) {
  let s = token.trim();
  if (s.startsWith("(") && s.endsWith(")")) s = s.slice(1, -1);
  return s
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")")
    .replace(/\\\\/g, "\\")
    .replace(/\\([0-7]{1,3})/g, (_, octal) => String.fromCharCode(parseInt(octal, 8)));
}

function escapeLatex(text) {
  return text
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/([#$%&_{}])/g, "\\$1")
    .replace(/\^/g, "\\textasciicircum{}")
    .replace(/~/g, "\\textasciitilde{}");
}
