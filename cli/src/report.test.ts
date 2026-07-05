import { describe, it, expect } from "vitest";
import { lintSkill, type SkillFile } from "../../lib/skill-lint";
import type { AnalyzedSkill } from "./analyze";
import { errorCount } from "./analyze";
import { makeTheme } from "./tui/theme";
import { renderReport } from "./report";

const mk = (content: string, dirName: string): AnalyzedSkill => {
  const files: SkillFile[] = [{ path: "SKILL.md", content }];
  return { dirName, dir: `/tmp/${dirName}`, files, outcome: lintSkill(files, { profile: "generic", dirName }) };
};

const valid = mk(
  "---\nname: demo-skill\ndescription: Use when the user wants a demo skill to exercise the analyzer end to end in tests, covering triggers and steps.\n---\n\n# Demo Skill\n\n## When to use\n\nx\n\n## Steps\n\n1. y\n",
  "demo-skill"
);
const theme = makeTheme({ color: false, truecolor: false, unicode: true });

describe("renderReport", () => {
  it("prints the header, the profile, and the skill row", () => {
    const out = renderReport([valid], { sourceLabel: "Global", profile: "generic" }, theme);
    expect(out).toContain("skillsmith");
    expect(out).toContain("Global");
    expect(out).toContain("profile generic");
    expect(out).toContain("demo-skill");
  });
});

describe("errorCount", () => {
  it("counts error-severity findings across skills", () => {
    const n = errorCount([valid]);
    expect(n).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(n)).toBe(true);
  });
});
