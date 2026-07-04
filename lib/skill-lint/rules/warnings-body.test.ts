import { describe, it, expect } from "vitest";
import { warningBodyRules } from "./warnings-body";
import { runRules } from "./engine";
import { parseSkill } from "../parser/skill";
import type { ParsedSkill, SkillFile } from "../model";

function build(body: string): ParsedSkill {
  const r = parseSkill([{ path: "SKILL.md", content: `---\nname: a-b\ndescription: Use when testing the body rules\n---\n${body}` }]);
  if (r.kind !== "skill") throw new Error("fixture is not a skill: " + r.reason);
  return r.skill;
}

function findings(body: string) {
  return runRules(build(body), warningBodyRules, { profile: "generic" });
}
function idsFor(body: string): string[] {
  return findings(body).map((f) => f.ruleId);
}

describe("W01 oversized body", () => {
  it("fires at 500+ lines", () => {
    expect(idsFor(Array.from({ length: 500 }, () => "line").join("\n"))).toContain("W01");
  });
  it("does not fire on a small body", () => {
    expect(idsFor("# Title\nShort body.")).not.toContain("W01");
  });
});

describe("W06 second-person body", () => {
  it("fires once and reports the first line", () => {
    const out = findings("Intro.\nyou should run the tests.\nyou must commit.").filter((f) => f.ruleId === "W06");
    expect(out).toHaveLength(1);
    expect(out[0].message).toContain("2");
  });
  it("does not fire on imperative prose", () => {
    expect(idsFor("Run the tests. Commit the result.")).not.toContain("W06");
  });
});

describe("W08 backslash paths with autofix", () => {
  it("fires per line (capped) and the fix rewrites backslashes", () => {
    const files: SkillFile[] = [
      { path: "SKILL.md", content: `---\nname: a-b\ndescription: Use when testing the body rules\n---\nSee references\\api.md now` },
    ];
    const r = parseSkill(files);
    if (r.kind !== "skill") throw new Error(r.reason);
    const out = runRules(r.skill, warningBodyRules, { profile: "generic" }).filter((f) => f.ruleId === "W08");
    expect(out).toHaveLength(1);
    expect(out[0].fix).toBeDefined();
    const fixed = out[0].fix!.apply(files);
    expect(fixed[0].content).toContain("references/api.md");
    expect(fixed[0].content).not.toContain("references\\api.md");
  });
  it("caps at 5 findings", () => {
    const lines = Array.from({ length: 8 }, (_, i) => `path a${i}\\b${i}.md`).join("\n");
    expect(findings(lines).filter((f) => f.ruleId === "W08")).toHaveLength(5);
  });
  it("does not fire on forward-slash paths", () => {
    expect(idsFor("See references/api.md")).not.toContain("W08");
  });
});

describe("W09 time-sensitive info", () => {
  it("fires on a dated reference", () => {
    expect(idsFor("This changed before August 2025 in the API.")).toContain("W09");
  });
  it("does not fire without a nearby year", () => {
    expect(idsFor("Run this before the tests.")).not.toContain("W09");
  });
});

describe("W16 unqualified MCP tool", () => {
  it("fires when MCP is mentioned with a bare backtick tool", () => {
    expect(idsFor("Call the MCP tool `search` to query.")).toContain("W16");
  });
  it("does not fire when the tool is qualified", () => {
    expect(idsFor("Call the MCP tool `Brave:search` to query.")).not.toContain("W16");
  });
});

describe("W20 vague qualifiers", () => {
  it("fires only when 2+ lines are vague", () => {
    expect(idsFor("Handle it properly.\nValidate correctly.")).toContain("W20");
  });
  it("does not fire on a single vague line", () => {
    expect(idsFor("Handle it properly.")).not.toContain("W20");
  });
});

describe("W21 caps directive density", () => {
  it("fires at 5+ MUST/NEVER/ALWAYS", () => {
    expect(idsFor("MUST do this. NEVER that. ALWAYS this. MUST here. NEVER there.")).toContain("W21");
  });
  it("does not fire below the threshold", () => {
    expect(idsFor("MUST do this. Never lowercase counts differently.")).not.toContain("W21");
  });
});
