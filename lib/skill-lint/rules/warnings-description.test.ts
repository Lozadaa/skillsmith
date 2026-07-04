import { describe, it, expect } from "vitest";
import { warningDescriptionRules } from "./warnings-description";
import { runRules } from "./engine";
import { parseSkill } from "../parser/skill";
import type { ParsedSkill } from "../model";

function build(fm: string): ParsedSkill {
  const r = parseSkill([{ path: "SKILL.md", content: `---\n${fm}\n---\nBody` }]);
  if (r.kind !== "skill") throw new Error("fixture is not a skill: " + r.reason);
  return r.skill;
}

function idsFor(fm: string): string[] {
  return runRules(build(fm), warningDescriptionRules, { profile: "generic" }).map((f) => f.ruleId);
}

describe("W02 description too short", () => {
  it("fires when a present description is under 20 chars", () => {
    expect(idsFor("name: a-b\ndescription: too short")).toContain("W02");
  });
  it("does not fire at 20+ chars", () => {
    expect(idsFor("name: a-b\ndescription: Use when the length is comfortably long")).not.toContain("W02");
  });
  it("does not fire when description is absent (E05 owns that)", () => {
    expect(idsFor("name: a-b")).not.toContain("W02");
  });
});

describe("W03 description soft ceiling", () => {
  it("fires between 501 and 1024 chars", () => {
    expect(idsFor(`name: a-b\ndescription: ${"x".repeat(600)}`)).toContain("W03");
  });
  it("does not fire at exactly 500 chars", () => {
    expect(idsFor(`name: a-b\ndescription: ${"x".repeat(500)}`)).not.toContain("W03");
  });
  it("does not fire above 1024 (E05 owns that)", () => {
    expect(idsFor(`name: a-b\ndescription: ${"x".repeat(1100)}`)).not.toContain("W03");
  });
});

describe("W04 first/second person", () => {
  it("fires on first/second person phrasing", () => {
    expect(idsFor("name: a-b\ndescription: You should use this to review code when needed")).toContain("W04");
    expect(idsFor("name: a-b\ndescription: I can help you when working on PDFs")).toContain("W04");
  });
  it("does not fire on capability + trigger phrasing", () => {
    expect(idsFor("name: a-b\ndescription: Use when reviewing pull requests for security issues")).not.toContain("W04");
  });
});

describe("W05 missing trigger marker", () => {
  it("fires when no trigger marker is present", () => {
    expect(idsFor("name: a-b\ndescription: Reviews pull requests for security issues")).toContain("W05");
  });
  it("does not fire when a trigger marker is present", () => {
    expect(idsFor("name: a-b\ndescription: Use when reviewing pull requests")).not.toContain("W05");
    expect(idsFor("name: a-b\ndescription: Reviews PRs. Triggers: security review")).not.toContain("W05");
  });
});

describe("W07 generic name segment", () => {
  it("fires when a kebab segment is a generic word", () => {
    expect(idsFor("name: data-helper\ndescription: Use when testing the linter")).toContain("W07");
    expect(idsFor("name: pdf-utils\ndescription: Use when testing the linter")).toContain("W07");
  });
  it("does not fire on a descriptive name", () => {
    expect(idsFor("name: processing-pdfs\ndescription: Use when testing the linter")).not.toContain("W07");
  });
});
