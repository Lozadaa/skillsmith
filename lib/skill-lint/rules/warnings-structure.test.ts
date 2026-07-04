import { describe, it, expect } from "vitest";
import { warningStructureRules } from "./warnings-structure";
import { runRules } from "./engine";
import { parseSkill } from "../parser/skill";
import type { SkillFile } from "../model";

function idsFor(files: SkillFile[]): string[] {
  const r = parseSkill(files);
  if (r.kind !== "skill") throw new Error("fixture is not a skill: " + r.reason);
  return runRules(r.skill, warningStructureRules, { profile: "generic" }).map((f) => f.ruleId);
}

const SKILL = (body: string): SkillFile => ({
  path: "SKILL.md",
  content: `---\nname: a-b\ndescription: Use when testing structure rules\n---\n${body}`,
});

describe("W10 references deeper than one level", () => {
  it("fires when a reference links to another skill file", () => {
    expect(
      idsFor([
        SKILL("See [a](references/a.md)"),
        { path: "references/a.md", content: "See [b](b.md)" },
        { path: "references/b.md", content: "leaf" },
      ])
    ).toContain("W10");
  });
  it("does not fire when references are leaves", () => {
    expect(
      idsFor([SKILL("See [a](references/a.md)"), { path: "references/a.md", content: "no links here" }])
    ).not.toContain("W10");
  });
});

describe("W11 orphan reference files", () => {
  it("fires on an unlinked .md file", () => {
    expect(idsFor([SKILL("No links at all"), { path: "references/orphan.md", content: "x" }])).toContain("W11");
  });
  it("does not fire when the file is linked", () => {
    expect(
      idsFor([SKILL("See [a](references/a.md)"), { path: "references/a.md", content: "x" }])
    ).not.toContain("W11");
  });
});

describe("W17 symlink portability", () => {
  it("fires on a symlink-flagged file", () => {
    expect(idsFor([SKILL("body"), { path: "references/a.md", content: "../shared/a.md", symlink: true }])).toContain("W17");
  });
  it("does not fire on a normal file", () => {
    expect(idsFor([SKILL("body"), { path: "references/a.md", content: "# Real content\nwith prose" }])).not.toContain("W17");
  });
});

describe("W18 packaging junk", () => {
  it("fires on junk paths", () => {
    expect(idsFor([SKILL("body"), { path: "scripts/__pycache__/x.pyc", content: "" }])).toContain("W18");
    expect(idsFor([SKILL("body"), { path: ".DS_Store", content: "" }])).toContain("W18");
  });
  it("does not fire on clean paths", () => {
    expect(idsFor([SKILL("body"), { path: "scripts/run.py", content: "print(1)" }])).not.toContain("W18");
  });
});

describe("W19 apparent secrets", () => {
  it("fires on an AWS-style key", () => {
    expect(idsFor([SKILL("body"), { path: "scripts/cfg.txt", content: "key AKIAIOSFODNN7EXAMPLE here" }])).toContain("W19");
  });
  it("fires on an inline api_key assignment", () => {
    expect(idsFor([SKILL('api_key = "abcdef0123456789ABCDEF"')])).toContain("W19");
  });
  it("does not fire on clean content", () => {
    expect(idsFor([SKILL("Nothing secret here.")])).not.toContain("W19");
  });
});
