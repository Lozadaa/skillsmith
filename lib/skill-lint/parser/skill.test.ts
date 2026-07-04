import { describe, it, expect } from "vitest";
import { parseSkill, looksLikeSymlink } from "./skill";

const VALID = `---\nname: demo-skill\ndescription: Use when demonstrating the parser\n---\n# Demo\nBody text.`;

describe("parseSkill", () => {
  it("parses a valid single-file skill", () => {
    const r = parseSkill([{ path: "SKILL.md", content: VALID }], { dirName: "demo-skill" });
    expect(r.kind).toBe("skill");
    if (r.kind === "skill") {
      expect(r.skill.frontmatter.data["name"]).toBe("demo-skill");
      expect(r.skill.dirName).toBe("demo-skill");
      expect(r.skill.filenameAsGiven).toBe("SKILL.md");
    }
  });

  it("accepts wrong-case skill.md but records the filename as given", () => {
    const r = parseSkill([{ path: "skill.md", content: VALID }]);
    expect(r.kind).toBe("skill");
    if (r.kind === "skill") expect(r.skill.filenameAsGiven).toBe("skill.md");
  });

  it("prefers exact SKILL.md over case variants", () => {
    const r = parseSkill([
      { path: "skill.md", content: VALID },
      { path: "SKILL.md", content: VALID },
    ]);
    if (r.kind === "skill") expect(r.skill.filenameAsGiven).toBe("SKILL.md");
  });

  it("returns not-a-skill when no SKILL.md exists", () => {
    const r = parseSkill([{ path: "README.md", content: "# hi" }]);
    expect(r).toEqual({ kind: "not-a-skill", reason: expect.stringMatching(/no skill\.md/i) });
  });

  it("returns not-a-skill for files without frontmatter (real-world fixture case)", () => {
    const r = parseSkill([{ path: "SKILL.md", content: "# Sample\n**Name**: fake\n" }]);
    expect(r.kind).toBe("not-a-skill");
    if (r.kind === "not-a-skill") expect(r.reason).toMatch(/frontmatter/i);
  });

  it("returns not-a-skill for a symlink degraded to a path string", () => {
    // Windows checkout of a git symlink: file content is just the target path
    const r = parseSkill([{ path: "SKILL.md", content: "../academic-paper" }]);
    expect(r.kind).toBe("not-a-skill");
    if (r.kind === "not-a-skill") expect(r.reason).toMatch(/symlink/i);
  });

  it("never throws on garbage input", () => {
    expect(() => parseSkill([{ path: "SKILL.md", content: "\0\0\0" }])).not.toThrow();
    expect(() => parseSkill([])).not.toThrow();
  });
});

describe("looksLikeSymlink", () => {
  it("detects explicit symlink flag and path-only content", () => {
    expect(looksLikeSymlink({ path: "SKILL.md", content: "x", symlink: true })).toBe(true);
    expect(looksLikeSymlink({ path: "SKILL.md", content: "../sibling/skills/foo" })).toBe(true);
    expect(looksLikeSymlink({ path: "SKILL.md", content: "---\nname: x\n---\nbody" })).toBe(false);
  });
});
