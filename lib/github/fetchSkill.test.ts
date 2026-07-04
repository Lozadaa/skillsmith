import { describe, it, expect } from "vitest";
import { fetchSkillFiles, findSkillMd } from "./fetchSkill";
import type { GitHubClient, TreeEntry } from "./client";
import type { DetectedSkillRef } from "./detect";

function entry(path: string, sha: string, mode = "100644", size = 10): TreeEntry {
  return { path, mode, type: "blob", sha, size };
}

/** Mock client whose getBlobText returns "blob:<sha>" (or the symlink target). */
function mockClient(overrides: Partial<GitHubClient> = {}): GitHubClient {
  return {
    getRepoTree: async () => ({ entries: [], truncated: false }),
    getBlobText: async (_o, _r, sha) => `blob:${sha}`,
    getReadme: async () => "",
    getGistFiles: async () => [],
    ...overrides,
  };
}

describe("findSkillMd", () => {
  it("finds the exact SKILL.md for a dir skill", () => {
    const entries = [entry("skills/foo/SKILL.md", "s1"), entry("skills/foo/reference.md", "s2")];
    const skill: DetectedSkillRef = { dirPath: "skills/foo", name: "foo", origin: "skills-dir", viaSymlink: false };
    expect(findSkillMd(skill, entries)?.sha).toBe("s1");
  });

  it("finds a root SKILL.md", () => {
    const entries = [entry("SKILL.md", "root")];
    const skill: DetectedSkillRef = { dirPath: "", name: "r", origin: "root", viaSymlink: false };
    expect(findSkillMd(skill, entries)?.sha).toBe("root");
  });
});

describe("fetchSkillFiles", () => {
  it("gathers every blob under the skill dir with relative forward-slash paths", async () => {
    const entries = [
      entry("skills/foo/SKILL.md", "s1"),
      entry("skills/foo/references/api.md", "s2"),
      entry("skills/foo/scripts/run.py", "s3"),
      entry("skills/other/SKILL.md", "s9"), // excluded — different skill
    ];
    const skill: DetectedSkillRef = { dirPath: "skills/foo", name: "foo", origin: "skills-dir", viaSymlink: false };
    const out = await fetchSkillFiles(mockClient(), "o", "r", "main", skill, entries);
    expect(out.dirName).toBe("foo");
    expect(out.files.map((f) => f.path).sort()).toEqual(["SKILL.md", "references/api.md", "scripts/run.py"]);
    expect(out.files.find((f) => f.path === "SKILL.md")?.content).toBe("blob:s1");
    expect(out.skipped).toEqual([]);
  });

  it("fetches only SKILL.md for a root single-file skill", async () => {
    const entries = [entry("SKILL.md", "root"), entry("README.md", "readme")];
    const skill: DetectedSkillRef = { dirPath: "", name: "my-skill", origin: "root", viaSymlink: false };
    const out = await fetchSkillFiles(mockClient(), "o", "r", "main", skill, entries);
    expect(out.files.map((f) => f.path)).toEqual(["SKILL.md"]);
    expect(out.dirName).toBe("my-skill");
  });

  it("skips files larger than 2 MB with a note and does not fetch them", async () => {
    let fetched = 0;
    const client = mockClient({
      getBlobText: async (_o, _r, sha) => {
        fetched++;
        return `blob:${sha}`;
      },
    });
    const entries = [
      entry("skills/foo/SKILL.md", "s1", "100644", 10),
      entry("skills/foo/big.bin", "s2", "100644", 3_000_000),
    ];
    const skill: DetectedSkillRef = { dirPath: "skills/foo", name: "foo", origin: "skills-dir", viaSymlink: false };
    const out = await fetchSkillFiles(client, "o", "r", "main", skill, entries);
    expect(out.files.map((f) => f.path)).toEqual(["SKILL.md"]);
    expect(out.skipped).toEqual([{ path: "big.bin", reason: expect.stringMatching(/2 MB/i) }]);
    expect(fetched).toBe(1);
  });

  it("marks mode-120000 blobs as symlinks with the target as content", async () => {
    const client = mockClient({ getBlobText: async () => "../shared/reference.md" });
    const entries = [
      entry("skills/foo/SKILL.md", "s1"),
      entry("skills/foo/link.md", "s2", "120000", 20),
    ];
    const skill: DetectedSkillRef = { dirPath: "skills/foo", name: "foo", origin: "skills-dir", viaSymlink: false };
    const out = await fetchSkillFiles(client, "o", "r", "main", skill, entries);
    const link = out.files.find((f) => f.path === "link.md");
    expect(link).toMatchObject({ symlink: true, content: "../shared/reference.md" });
  });
});
