import { describe, it, expect } from "vitest";
import { resolveTarget } from "./importFlow";
import type { GitHubClient } from "./client";

const SKILL_MD = (name: string) => `---\nname: ${name}\ndescription: Use when demonstrating the ${name} skill in tests\n---\n# ${name}\nBody.`;

function client(overrides: Partial<GitHubClient> = {}): GitHubClient {
  return {
    getRepoTree: async () => ({ entries: [], truncated: false }),
    getBlobText: async () => SKILL_MD("demo-skill"),
    getReadme: async () => "",
    getGistFiles: async () => [],
    ...overrides,
  };
}

describe("resolveTarget (repo → picker)", () => {
  it("detects skills and mini-lints each, reporting progress", async () => {
    const steps: string[] = [];
    const c = client({
      getRepoTree: async () => ({
        entries: [
          { path: "skills/alpha/SKILL.md", mode: "100644", type: "blob", sha: "a" },
          { path: "skills/beta/SKILL.md", mode: "100644", type: "blob", sha: "b" },
        ],
        truncated: false,
      }),
      getBlobText: async (_o, _r, sha) => SKILL_MD(sha === "a" ? "alpha" : "beta"),
    });
    const result = await resolveTarget(c, { kind: "repo", owner: "o", repo: "r" }, (s) => steps.push(s));
    if (result.mode !== "picker") throw new Error("expected picker");
    expect(result.skills.map((s) => s.ref.name)).toEqual(["alpha", "beta"]);
    expect(result.skills.every((s) => s.lint.ok && s.scanned)).toBe(true);
    expect(result.skills[0].lint.score).toBeGreaterThan(0);
    expect(steps.some((s) => /Analyzing/i.test(s))).toBe(true);
  });

  it("passes the truncated flag through", async () => {
    const c = client({
      getRepoTree: async () => ({
        entries: [{ path: "SKILL.md", mode: "100644", type: "blob", sha: "s" }],
        truncated: true,
      }),
    });
    const result = await resolveTarget(c, { kind: "repo", owner: "o", repo: "r" });
    expect(result.mode === "picker" && result.truncated).toBe(true);
  });
});

describe("resolveTarget (repo → links fallback)", () => {
  it("returns README repo links when no SKILL.md exists", async () => {
    const c = client({
      getRepoTree: async () => ({ entries: [{ path: "README.md", mode: "100644", type: "blob", sha: "r" }], truncated: false }),
      getReadme: async () => "[a](https://github.com/x/y)",
    });
    const result = await resolveTarget(c, { kind: "repo", owner: "o", repo: "r" });
    expect(result.mode).toBe("links");
    if (result.mode === "links") expect(result.links).toEqual([{ owner: "x", repo: "y", label: "a" }]);
  });
});

describe("resolveTarget (gist)", () => {
  it("builds a single-skill result from gist files", async () => {
    const c = client({
      getGistFiles: async () => [{ filename: "SKILL.md", content: SKILL_MD("gist-skill"), truncated: false }],
    });
    const result = await resolveTarget(c, { kind: "gist", gistId: "g1" });
    if (result.mode !== "gist") throw new Error("expected gist");
    expect(result.files.map((f) => f.path)).toContain("SKILL.md");
    expect(result.lint.ok).toBe(true);
  });

  it("returns empty when a gist has no SKILL.md", async () => {
    const c = client({ getGistFiles: async () => [{ filename: "notes.txt", content: "hi", truncated: false }] });
    const result = await resolveTarget(c, { kind: "gist", gistId: "g1" });
    expect(result.mode).toBe("empty");
  });
});
