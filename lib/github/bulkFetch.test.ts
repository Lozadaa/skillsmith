import { describe, it, expect } from "vitest";
import { fetchAllSkills } from "./bulkFetch";
import { RateLimitError, type GitHubClient, type TreeEntry } from "./client";
import type { DetectedSkillRef } from "./detect";

const SKILL_MD = "---\nname: x\ndescription: y\n---\nbody";

function entriesFor(dirs: string[]): TreeEntry[] {
  return dirs.map((d) => ({ path: `${d}/SKILL.md`, mode: "100644", type: "blob" as const, sha: `sha-${d}` }));
}

function refFor(dirPath: string, name: string): DetectedSkillRef {
  return { dirPath, name, origin: "skills-dir", viaSymlink: false };
}

function client(getBlobText: GitHubClient["getBlobText"]): GitHubClient {
  return {
    getRepoTree: async () => ({ entries: [], truncated: false }),
    getBlobText,
    getReadme: async () => "",
    getGistFiles: async () => [],
  } as unknown as GitHubClient;
}

describe("fetchAllSkills", () => {
  it("fetches skills sequentially and reports progress i/N", async () => {
    const steps: string[] = [];
    const entries = entriesFor(["skills/a", "skills/b"]);
    const c = client(async () => SKILL_MD);
    const res = await fetchAllSkills(
      c,
      "o",
      "r",
      "main",
      [refFor("skills/a", "a"), refFor("skills/b", "b")],
      entries,
      (s) => steps.push(s)
    );
    expect(res.zips.map((z) => z.name)).toEqual(["a", "b"]);
    expect(steps).toEqual(["Fetching skill 1/2: a", "Fetching skill 2/2: b"]);
  });

  it("dedupes colliding folder names with -2, -3 suffixes", async () => {
    // Two flat skills whose dirName basename is the same ("helper").
    const entries = entriesFor(["one/helper", "two/helper"]);
    const c = client(async () => SKILL_MD);
    const res = await fetchAllSkills(
      c,
      "o",
      "r",
      "main",
      [refFor("one/helper", "helper"), refFor("two/helper", "helper")],
      entries
    );
    expect(res.zips.map((z) => z.name)).toEqual(["helper", "helper-2"]);
  });

  it("propagates a RateLimitError and aborts the batch", async () => {
    const entries = entriesFor(["skills/a", "skills/b"]);
    const c = client(async () => {
      throw new RateLimitError(1700000000);
    });
    await expect(
      fetchAllSkills(c, "o", "r", "main", [refFor("skills/a", "a"), refFor("skills/b", "b")], entries)
    ).rejects.toBeInstanceOf(RateLimitError);
  });
});
