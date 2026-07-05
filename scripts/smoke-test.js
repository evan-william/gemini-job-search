import { access } from "node:fs/promises";
import { spawn } from "node:child_process";

const commands = [
  ["node", ["src/cli.js", "audit", "--profile", "profile/candidate.md", "--job", "samples/job-posting.md"]],
  ["node", ["src/cli.js", "portfolio", "--profile", "profile/candidate.md", "--job", "samples/job-posting.md"]],
  ["node", ["src/cli.js", "outreach", "--profile", "profile/candidate.md", "--job", "samples/job-posting.md"]],
  ["node", ["src/cli.js", "interview", "--profile", "profile/candidate.md", "--job", "samples/job-posting.md"]],
  ["node", ["src/cli.js", "scrape", "--profile", "profile/candidate.md", "--source", "samples/job-posting.md"]],
  ["node", ["src/cli.js", "prompt", "--workflow", "full", "--profile", "profile/candidate.md", "--job", "samples/job-posting.md"]]
];

for (const [cmd, args] of commands) {
  await run(cmd, args);
}

const expected = [
  "workspace/audits/job-posting.md",
  "workspace/portfolio/job-posting.md",
  "workspace/outreach/job-posting.md",
  "workspace/interviews/job-posting.md",
  "workspace/scrape/job-posting.md",
  "workspace/prompts/full-job-posting.md"
];

for (const file of expected) {
  await access(file);
}

console.log("Smoke test passed.");

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { shell: true, stdio: "inherit" });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} failed with code ${code}`));
    });
  });
}
