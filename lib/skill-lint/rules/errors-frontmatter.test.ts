import { describe, it, expect } from "vitest";
import { frontmatterErrorRules } from "./errors-frontmatter";
import { runRules } from "./engine";
import { parseSkill } from "../parser/skill";
import type { ParsedSkill } from "../model";

function build(fm: string, dirName?: string): ParsedSkill {
  const r = parseSkill([{ path: "SKILL.md", content: `---\n${fm}\n---\nBody` }], { dirName });
  if (r.kind !== "skill") throw new Error("fixture is not a skill: " + r.reason);
  return r.skill;
}

function idsFor(fm: string, dirName?: string): string[] {
  return runRules(build(fm, dirName), frontmatterErrorRules, { profile: "generic" }).map((f) => f.ruleId);
}

describe("E01 valid YAML", () => {
  it("fires on unparseable frontmatter", () => {
    const skill = build("name: x\ndescription: ok");
    skill.frontmatter.parseError = { message: "bad" };
    const ids = runRules(skill, frontmatterErrorRules, { profile: "generic" }).map((f) => f.ruleId);
    expect(ids).toContain("E01");
  });
  it("does not fire on recovered frontmatter (E12 owns that)", () => {
    const skill = build("name: x\ndescription: ok");
    skill.frontmatter.recovered = true;
    const ids = runRules(skill, frontmatterErrorRules, { profile: "generic" }).map((f) => f.ruleId);
    expect(ids).not.toContain("E01");
  });
});

describe("E02 name format", () => {
  it("passes a valid kebab-case name", () => {
    expect(idsFor("name: my-good-skill\ndescription: Use when testing")).not.toContain("E02");
  });
  it.each([
    ["missing", "description: only"],
    ["uppercase", "name: MySkill\ndescription: x"],
    ["leading hyphen", "name: -21risk\ndescription: x"],
    ["double hyphen", "name: a--b\ndescription: x"],
    ["underscore", "name: a_b\ndescription: x"],
    ["too long", `name: ${"a".repeat(65)}\ndescription: x`],
  ])("fires on %s", (_label, fm) => {
    expect(idsFor(fm)).toContain("E02");
  });
  it("passes a name of exactly 64 chars", () => {
    expect(idsFor(`name: ${"a".repeat(64)}\ndescription: Use when testing`)).not.toContain("E02");
  });
});

describe("E03 reserved words", () => {
  it("fires on claude/anthropic in name", () => {
    expect(idsFor("name: claude-helper\ndescription: x")).toContain("E03");
    expect(idsFor("name: anthropic-tools\ndescription: x")).toContain("E03");
    expect(idsFor("name: my-skill\ndescription: x")).not.toContain("E03");
  });
});

describe("E04 name matches folder", () => {
  it("fires on mismatch, silent when dirName unknown", () => {
    expect(idsFor("name: my-skill\ndescription: x", "other-folder")).toContain("E04");
    expect(idsFor("name: my-skill\ndescription: x", "my-skill")).not.toContain("E04");
    expect(idsFor("name: my-skill\ndescription: x")).not.toContain("E04");
  });
});

describe("E05 description", () => {
  it("fires on missing, empty, non-string, too long, duplicated", () => {
    expect(idsFor("name: a-b")).toContain("E05");
    expect(idsFor('name: a-b\ndescription: ""')).toContain("E05");
    expect(idsFor("name: a-b\ndescription: 42")).toContain("E05");
    expect(idsFor(`name: a-b\ndescription: ${"x".repeat(1025)}`)).toContain("E05");
    expect(idsFor("name: a-b\ndescription: one\ndescription: two")).toContain("E05");
    expect(idsFor("name: a-b\ndescription: Use when testing")).not.toContain("E05");
  });
  it("passes a description of exactly 1024 chars", () => {
    expect(idsFor(`name: a-b\ndescription: ${"x".repeat(1024)}`)).not.toContain("E05");
  });
});

describe("E06 no angle brackets in frontmatter values", () => {
  it("fires on <> anywhere, including nested metadata", () => {
    expect(idsFor("name: a-b\ndescription: use <tag> here")).toContain("E06");
    expect(idsFor("name: a-b\ndescription: ok\nmetadata:\n  author: <me>")).toContain("E06");
    expect(idsFor("name: a-b\ndescription: ok")).not.toContain("E06");
  });
  it("fires on < or > inside an array element", () => {
    expect(idsFor("name: a-b\ndescription: ok\nmetadata:\n  tags:\n    - \"has <angle>\"")).toContain("E06");
  });
});

describe("E07 compatibility length", () => {
  it("fires only above 500 chars", () => {
    expect(idsFor(`name: a-b\ndescription: ok\ncompatibility: ${"c".repeat(501)}`)).toContain("E07");
    expect(idsFor("name: a-b\ndescription: ok\ncompatibility: Requires Claude Code")).not.toContain("E07");
  });
  it("passes compatibility of exactly 500 chars", () => {
    expect(idsFor(`name: a-b\ndescription: ok\ncompatibility: ${"c".repeat(500)}`)).not.toContain("E07");
  });
});
