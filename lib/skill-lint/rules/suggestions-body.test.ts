import { describe, it, expect } from "vitest";
import { suggestionBodyRules } from "./suggestions-body";
import { runRules } from "./engine";
import { parseSkill } from "../parser/skill";
import type { ParsedSkill, SkillFile } from "../model";

function build(body: string, files: SkillFile[] = []): ParsedSkill {
  const all = [
    { path: "SKILL.md", content: `---\nname: a-b\ndescription: Use when testing body suggestions\n---\n${body}` },
    ...files,
  ];
  const r = parseSkill(all);
  if (r.kind !== "skill") throw new Error("fixture is not a skill: " + r.reason);
  return r.skill;
}
function idsFor(body: string, files: SkillFile[] = []): string[] {
  return runRules(build(body, files), suggestionBodyRules, { profile: "generic" }).map((f) => f.ruleId);
}

describe("S04 no headings", () => {
  it("fires on a long body without headings", () => {
    expect(idsFor(Array.from({ length: 25 }, (_, i) => `line ${i}`).join("\n"))).toContain("S04");
  });
  it("does not fire when headings exist", () => {
    expect(idsFor("# Title\n" + Array.from({ length: 25 }, () => "line").join("\n"))).not.toContain("S04");
  });
});

describe("S08 excessive alternatives", () => {
  it("fires on a line with 3+ 'or'", () => {
    expect(idsFor("Choose red or green or blue or yellow.")).toContain("S08");
  });
  it("does not fire on a single 'or'", () => {
    expect(idsFor("Choose red or green.")).not.toContain("S08");
  });
});

describe("S09 missing troubleshooting", () => {
  it("fires on multi-step body with no troubleshooting heading", () => {
    expect(idsFor("## Steps\n1. do a\n2. do b\n3. do c")).toContain("S09");
  });
  it("does not fire when a troubleshooting heading exists", () => {
    expect(idsFor("## Steps\n1. do a\n2. do b\n3. do c\n## Troubleshooting\ntips")).not.toContain("S09");
  });
});

describe("S10 prose-only validation", () => {
  it("fires when validation is prose and there is no script", () => {
    expect(idsFor("Validate the output.\nVerify the schema.")).toContain("S10");
  });
  it("does not fire when a script exists", () => {
    expect(idsFor("Validate the output.\nVerify the schema.", [{ path: "scripts/check.py", content: "print(1)" }])).not.toContain("S10");
  });
});

describe("S13 duplicated content", () => {
  it("fires when 3+ long lines are shared with a reference", () => {
    const shared = [
      "This is a sufficiently long shared sentence number one that exceeds sixty characters.",
      "This is a sufficiently long shared sentence number two that exceeds sixty characters.",
      "This is a sufficiently long shared sentence number three that exceeds sixty chars ok.",
    ].join("\n");
    expect(idsFor(shared, [{ path: "references/a.md", content: shared }])).toContain("S13");
  });
  it("does not fire without enough overlap", () => {
    expect(idsFor("short body", [{ path: "references/a.md", content: "different content entirely" }])).not.toContain("S13");
  });
});

describe("S14 mega-skill", () => {
  it("fires on a long body with many depth-2 headings", () => {
    const headings = Array.from({ length: 8 }, (_, i) => `## Section ${i}\n${"word ".repeat(400)}`).join("\n");
    expect(idsFor(headings)).toContain("S14");
  });
  it("does not fire on a small body", () => {
    expect(idsFor("## One\n## Two\nshort")).not.toContain("S14");
  });
});
