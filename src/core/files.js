import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, basename, extname } from "node:path";

export async function readText(path) {
  return readFile(path, "utf8");
}

export async function readTextWithFallback(path, fallbackPath) {
  try {
    return await readText(path);
  } catch (error) {
    if (error && error.code === "ENOENT" && fallbackPath) {
      return readText(fallbackPath);
    }
    throw error;
  }
}

export async function writeText(path, text) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, text, "utf8");
}

export function slugify(input) {
  const base = basename(input, extname(input));
  return base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "job";
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function requireFlag(flags, name, fallback) {
  const value = flags[name] || fallback;
  if (!value) {
    throw new Error(`Missing required flag --${name}`);
  }
  return value;
}

export function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (item.startsWith("--")) {
      const key = item.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith("--")) {
        args[key] = true;
      } else {
        args[key] = next;
        i += 1;
      }
    } else {
      args._.push(item);
    }
  }
  return args;
}

export async function readBundle(flags) {
  const profilePath = requireFlag(flags, "profile", "profile/candidate.md");
  const jobPath = requireFlag(flags, "job", "samples/job-posting.md");
  const [profile, job] = await Promise.all([
    readTextWithFallback(profilePath, "profile/candidate.example.md"),
    readText(jobPath)
  ]);
  return { profilePath, jobPath, profile, job };
}
