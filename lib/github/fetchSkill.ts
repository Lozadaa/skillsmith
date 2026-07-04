import type { SkillFile } from "@/lib/skill-lint";
import type { GitHubClient, TreeEntry } from "./client";
import type { DetectedSkillRef } from "./detect";

export interface FetchedSkill {
  files: SkillFile[];
  dirName: string;
  skipped: { path: string; reason: string }[];
}

const MAX_BYTES = 2 * 1024 * 1024;
const CONCURRENCY = 4;

/** Conventional skill subdirs that ride along with a root-level SKILL.md. */
const ROOT_SKILL_SUBDIRS = ["references", "reference", "resources", "scripts", "assets", "examples", "templates"];

function basename(p: string): string {
  const i = p.lastIndexOf("/");
  return i === -1 ? p : p.slice(i + 1);
}

export function findSkillMd(skill: DetectedSkillRef, entries: TreeEntry[]): TreeEntry | undefined {
  const target = skill.dirPath === "" ? "SKILL.md" : `${skill.dirPath}/SKILL.md`;
  const exact = entries.find((e) => e.type === "blob" && e.path === target);
  if (exact) return exact;
  // Fall back to a case variant in the same directory.
  return entries.find(
    (e) =>
      e.type === "blob" &&
      /^skill\.md$/i.test(basename(e.path)) &&
      e.path.slice(0, Math.max(0, e.path.lastIndexOf("/"))) === skill.dirPath
  );
}

/** Run an async mapper over items with a bounded number of workers, preserving order. */
export async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker(): Promise<void> {
    while (next < items.length) {
      const idx = next++;
      results[idx] = await fn(items[idx]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

export async function fetchSkillFiles(
  client: GitHubClient,
  owner: string,
  repo: string,
  ref: string,
  skill: DetectedSkillRef,
  entries: TreeEntry[]
): Promise<FetchedSkill> {
  void ref; // blobs are addressed by sha; ref is retained for API symmetry.
  const dirName = skill.dirPath === "" ? skill.name : basename(skill.dirPath);

  // Which blobs belong to this skill.
  let blobs: TreeEntry[];
  if (skill.dirPath === "") {
    const skillMd = findSkillMd(skill, entries);
    blobs = skillMd
      ? entries.filter((e) => {
          if (e.type !== "blob") return false;
          if (e.path === skillMd.path) return true;
          const topDir = e.path.includes("/") ? e.path.slice(0, e.path.indexOf("/")) : "";
          return ROOT_SKILL_SUBDIRS.includes(topDir);
        })
      : [];
  } else {
    const prefix = skill.dirPath + "/";
    blobs = entries.filter((e) => e.type === "blob" && e.path.startsWith(prefix));
  }

  const skipped: { path: string; reason: string }[] = [];
  const relOf = (e: TreeEntry) => (skill.dirPath === "" ? e.path : e.path.slice(skill.dirPath.length + 1));

  const toFetch = blobs.filter((e) => {
    if (typeof e.size === "number" && e.size > MAX_BYTES) {
      skipped.push({ path: relOf(e), reason: `File is over 2 MB (${e.size} bytes) — skipped` });
      return false;
    }
    return true;
  });

  const files = await mapWithConcurrency(toFetch, CONCURRENCY, async (e): Promise<SkillFile> => {
    const content = await client.getBlobText(owner, repo, e.sha);
    const path = relOf(e);
    return e.mode === "120000" ? { path, content, symlink: true } : { path, content };
  });

  return { files, dirName, skipped };
}
