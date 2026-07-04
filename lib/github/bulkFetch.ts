import type { SkillFile } from "@/lib/skill-lint";
import { RateLimitError, type GitHubClient, type TreeEntry } from "./client";
import type { DetectedSkillRef } from "./detect";
import { fetchSkillFiles } from "./fetchSkill";

export interface CollectionZip {
  name: string;
  files: SkillFile[];
}

export interface BulkResult {
  zips: CollectionZip[];
  skipped: string[];
}

/**
 * Fetch every detected skill's files. `fetchSkillFiles` already fans out 4-wide
 * per skill, so we walk skills SEQUENTIALLY to keep total concurrency at 4.
 * A RateLimitError aborts the whole batch (re-thrown).
 */
export async function fetchAllSkills(
  client: GitHubClient,
  owner: string,
  repo: string,
  ref: string,
  skills: DetectedSkillRef[],
  entries: TreeEntry[],
  onStep: (step: string) => void = () => {}
): Promise<BulkResult> {
  const zips: CollectionZip[] = [];
  const skipped: string[] = [];
  const used = new Set<string>();

  for (let i = 0; i < skills.length; i++) {
    const ref0 = skills[i];
    onStep(`Fetching skill ${i + 1}/${skills.length}: ${ref0.name}`);

    let fetched: Awaited<ReturnType<typeof fetchSkillFiles>>;
    try {
      fetched = await fetchSkillFiles(client, owner, repo, ref, ref0, entries);
    } catch (e) {
      if (e instanceof RateLimitError) throw e;
      skipped.push(`${ref0.name}: failed to fetch`);
      continue;
    }

    if (fetched.files.length === 0) {
      skipped.push(`${ref0.name}: no files found`);
      continue;
    }

    // Dedupe collisions with -2, -3 … suffixes.
    const base = fetched.dirName || ref0.name;
    let name = base;
    let n = 2;
    while (used.has(name)) name = `${base}-${n++}`;
    used.add(name);

    zips.push({ name, files: fetched.files });
    for (const s of fetched.skipped) skipped.push(`${name}/${s.path}: ${s.reason}`);
  }

  return { zips, skipped };
}
