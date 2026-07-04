import { describe, it, expect } from "vitest";
import { suggestionMetadataRules } from "./suggestions-metadata";
import { runRules } from "./engine";
import { parseSkill } from "../parser/skill";
import type { ParsedSkill, SkillFile } from "../model";

function build(fm: string, files: SkillFile[] = []): ParsedSkill {
  const all = [{ path: "SKILL.md", content: `---\n${fm}\n---\nBody` }, ...files];
  const r = parseSkill(all);
  if (r.kind !== "skill") throw new Error("fixture is not a skill: " + r.reason);
  return r.skill;
}
function idsFor(fm: string, files: SkillFile[] = []): string[] {
  return runRules(build(fm, files), suggestionMetadataRules, { profile: "generic" }).map((f) => f.ruleId);
}

describe("S01 gerund naming", () => {
  it("fires when the first segment is not a gerund", () => {
    expect(idsFor("name: pdf-processor\ndescription: Use when testing")).toContain("S01");
  });
  it("does not fire on a gerund-first name", () => {
    expect(idsFor("name: processing-pdfs\ndescription: Use when testing")).not.toContain("S01");
  });
});

describe("S02 quoted trigger phrases", () => {
  it("fires when no quoted phrase is present", () => {
    expect(idsFor("name: a-b\ndescription: Use when reviewing pull requests")).toContain("S02");
  });
  it("does not fire when a quoted phrase is present", () => {
    expect(idsFor('name: a-b\ndescription: Use when the user says "review my PR"')).not.toContain("S02");
  });
});

describe("S03 negative triggers for broad scope", () => {
  it("fires on a long description with no negative trigger", () => {
    expect(idsFor(`name: a-b\ndescription: ${"Use when reviewing code. ".repeat(12)}`)).toContain("S03");
  });
  it("does not fire when a negative trigger is present", () => {
    expect(idsFor(`name: a-b\ndescription: ${"Use when reviewing code. ".repeat(12)} Do not use for infra.`)).not.toContain("S03");
  });
});

describe("S11 license consistency", () => {
  it("fires when license key exists but no LICENSE file", () => {
    expect(idsFor("name: a-b\ndescription: Use when testing\nlicense: MIT")).toContain("S11");
  });
  it("fires when a LICENSE file exists but no license key", () => {
    expect(idsFor("name: a-b\ndescription: Use when testing", [{ path: "LICENSE", content: "MIT" }])).toContain("S11");
  });
  it("does not fire when both are present", () => {
    expect(idsFor("name: a-b\ndescription: Use when testing\nlicense: MIT", [{ path: "LICENSE.txt", content: "MIT" }])).not.toContain("S11");
  });
});

describe("S15 versioning nudge", () => {
  it("fires when no version is declared", () => {
    expect(idsFor("name: a-b\ndescription: Use when testing")).toContain("S15");
  });
  it("does not fire when metadata.version is present", () => {
    expect(idsFor("name: a-b\ndescription: Use when testing\nmetadata:\n  version: 1.0.0")).not.toContain("S15");
  });
});
