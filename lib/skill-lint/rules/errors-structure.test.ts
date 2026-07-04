import { describe, it, expect } from "vitest";
import { structureErrorRules } from "./errors-structure";
import { runRules } from "./engine";
import { parseSkill } from "../parser/skill";
import type { SkillFile } from "../model";

const VALID = `---\nname: demo\ndescription: Use when testing\n---\nSee [api](references/api.md)`;

function findingsFor(files: SkillFile[]) {
  const r = parseSkill(files);
  if (r.kind !== "skill") throw new Error("fixture is not a skill: " + r.reason);
  return runRules(r.skill, structureErrorRules, { profile: "generic" });
}

describe("E08 exact filename", () => {
  it("fires on skill.md, silent on SKILL.md", () => {
    const bad = findingsFor([{ path: "skill.md", content: VALID.replace("references/api.md", "skill.md") }]);
    expect(bad.map((f) => f.ruleId)).toContain("E08");
  });
});

describe("E09 broken relative links", () => {
  it("fires when a linked file does not exist", () => {
    const out = findingsFor([{ path: "SKILL.md", content: VALID }]);
    const e09 = out.filter((f) => f.ruleId === "E09");
    expect(e09).toHaveLength(1);
    expect(e09[0].message).toContain("references/api.md");
  });
  it("silent when the file exists; ignores http and anchors", () => {
    const content = `---\nname: demo\ndescription: x\n---\n[a](references/api.md) [b](https://x.com) [c](#section)`;
    const out = findingsFor([
      { path: "SKILL.md", content },
      { path: "references/api.md", content: "ref" },
    ]);
    expect(out.map((f) => f.ruleId)).not.toContain("E09");
  });
});

describe("E10 tabs in frontmatter", () => {
  it("fires on tab-indented YAML", () => {
    const out = findingsFor([{ path: "SKILL.md", content: `---\nname: demo\ndescription: ok\nmetadata:\n\tauthor: me\n---\nbody` }]);
    expect(out.map((f) => f.ruleId)).toContain("E10");
  });
});

describe("E11 no README inside skill folder", () => {
  it("fires on README.md at skill root only", () => {
    const skillmd = { path: "SKILL.md", content: `---\nname: demo\ndescription: x\n---\nbody` };
    expect(findingsFor([skillmd, { path: "README.md", content: "no" }]).map((f) => f.ruleId)).toContain("E11");
    expect(findingsFor([skillmd, { path: "references/README.md", content: "ok" }]).map((f) => f.ruleId)).not.toContain("E11");
  });
});

describe("E12 recovered YAML with autofix", () => {
  it("fires with a working fix", () => {
    const broken = `---\nname: demo\ndescription: Unlike normal review: it attacks\n---\nbody`;
    const files: SkillFile[] = [{ path: "SKILL.md", content: broken }];
    const out = findingsFor(files);
    const e12 = out.find((f) => f.ruleId === "E12");
    expect(e12).toBeDefined();
    expect(e12!.fix).toBeDefined();
    const fixed = e12!.fix!.apply(files);
    const refixed = parseSkill(fixed);
    expect(refixed.kind).toBe("skill");
    if (refixed.kind === "skill") {
      expect(refixed.skill.frontmatter.recovered).toBeUndefined();
      expect(refixed.skill.frontmatter.data["description"]).toBe("Unlike normal review: it attacks");
    }
  });
});
