import { describe, it, expect } from "vitest";
import { lintSkill, type SkillFile } from "../../../lib/skill-lint";
import type { AnalyzedSkill } from "../analyze";
import type { SourceRef } from "../scan";
import { makeTheme } from "./theme";
import { render } from "./render";
import type { State } from "./state";

const VALID: SkillFile[] = [
  {
    path: "SKILL.md",
    content:
      "---\nname: demo-skill\ndescription: Use when the user wants a demo skill to exercise the analyzer end to end in tests, covering triggers and steps.\n---\n\n# Demo Skill\n\n## When to use\n\nWhen rendering.\n\n## Steps\n\n1. Do a thing.\n",
  },
];

const skill: AnalyzedSkill = {
  dirName: "demo-skill",
  dir: "/tmp/demo-skill",
  files: VALID,
  outcome: lintSkill(VALID, { profile: "generic", dirName: "demo-skill" }),
};

const source: SourceRef = { id: "global", label: "Global (~/.claude/skills)", root: "/g" };
const theme = makeTheme({ color: false, truecolor: false, unicode: true });

const base: State = {
  sources: [source],
  source,
  profile: "generic",
  skills: [skill],
  screen: "list",
  cursor: 0,
  findingCursor: 0,
  input: "",
  cols: 80,
  rows: 24,
};

describe("render", () => {
  it("list screen shows the wordmark, the skill, and the footer", () => {
    const out = render(base, theme);
    expect(out).toContain("skillsmith");
    expect(out).toContain("demo-skill");
    expect(out).toContain("inspect");
  });

  it("detail screen shows findings and the token breakdown", () => {
    const out = render({ ...base, screen: "detail" }, theme);
    expect(out).toContain("Findings");
    expect(out).toContain("Tokens");
  });

  it("source screen lists the sources", () => {
    const out = render({ ...base, screen: "source" }, theme);
    expect(out).toContain("choose a source");
    expect(out).toContain("Global");
  });
});
