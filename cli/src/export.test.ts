import { describe, it, expect } from "vitest";
import { lintSkill, type SkillFile } from "../../lib/skill-lint";
import type { AnalyzedSkill } from "./analyze";
import { toJson, toMarkdown } from "./export";

const VALID: SkillFile[] = [
  {
    path: "SKILL.md",
    content:
      "---\nname: demo-skill\ndescription: Use when the user wants a demo skill to exercise the analyzer end to end in tests, covering triggers and steps.\n---\n\n# Demo Skill\n\n## When to use\n\nWhen testing the exporter.\n\n## Steps\n\n1. Do a thing.\n2. Do another thing.\n",
  },
];

const skill: AnalyzedSkill = {
  dirName: "demo-skill",
  dir: "/tmp/demo-skill",
  files: VALID,
  outcome: lintSkill(VALID, { profile: "generic", dirName: "demo-skill" }),
};

const meta = { source: "test", profile: "generic", generatedAt: "2026-07-05T00:00:00.000Z" };

describe("toJson", () => {
  it("emits score, tokens, and findings without the fix function", () => {
    const parsed = JSON.parse(toJson([skill], meta));
    expect(parsed.skills).toHaveLength(1);
    const s = parsed.skills[0];
    expect(s.dirName).toBe("demo-skill");
    expect(typeof s.score.value).toBe("number");
    expect(s.tokens.total).toBeGreaterThan(0);
    for (const f of s.findings) expect("fix" in f).toBe(false);
  });
});

describe("toMarkdown", () => {
  it("renders a header, the summary row, and a per-skill section", () => {
    const md = toMarkdown([skill], meta);
    expect(md).toContain("# Skillsmith report");
    expect(md).toContain("demo-skill");
    expect(md).toContain("Tokens:");
  });
});
