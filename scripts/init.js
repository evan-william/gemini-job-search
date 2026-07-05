import { access, copyFile, mkdir } from "node:fs/promises";

await mkdir("profile", { recursive: true });
await mkdir("jobs", { recursive: true });
await mkdir("workspace/audits", { recursive: true });
await mkdir("workspace/portfolio", { recursive: true });
await mkdir("workspace/outreach", { recursive: true });
await mkdir("workspace/interviews", { recursive: true });
await mkdir("workspace/prompts", { recursive: true });

await copyIfMissing("jobs/TEMPLATE.md", "jobs/first-target.md");

console.log("Initialized local workspace.");
console.log("Put your CV at profile/candidate.pdf.");
console.log("Without a private PDF, workflows use profile/candidate.example.md.");
console.log("If PDF extraction fails, create profile/candidate.md manually.");
console.log("Paste a job posting into jobs/first-target.md.");

async function copyIfMissing(source, target) {
  try {
    await access(target);
    console.log(`Kept existing ${target}`);
  } catch {
    await copyFile(source, target);
    console.log(`Created ${target}`);
  }
}
