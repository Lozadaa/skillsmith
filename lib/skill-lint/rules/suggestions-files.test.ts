import { describe, it, expect } from "vitest";
import { suggestionFileRules } from "./suggestions-files";
import { runRules } from "./engine";
import { parseSkill } from "../parser/skill";
import type { SkillFile } from "../model";

function idsFor(files: SkillFile[]): string[] {
  const r = parseSkill(files);
  if (r.kind !== "skill") throw new Error("fixture is not a skill: " + r.reason);
  return runRules(r.skill, suggestionFileRules, { profile: "generic" }).map((f) => f.ruleId);
}
const SKILL = (body: string): SkillFile => ({
  path: "SKILL.md",
  content: `---\nname: a-b\ndescription: Use when testing file suggestions\n---\n${body}`,
});

describe("S05 long reference without TOC", () => {
  it("fires on a 300+ line reference lacking a TOC", () => {
    const big = Array.from({ length: 320 }, (_, i) => `line ${i}`).join("\n");
    expect(idsFor([SKILL("See [a](references/a.md)"), { path: "references/a.md", content: big }])).toContain("S05");
  });
  it("does not fire when a TOC is present", () => {
    const big = "# Contents\n" + Array.from({ length: 320 }, (_, i) => `line ${i}`).join("\n");
    expect(idsFor([SKILL("See [a](references/a.md)"), { path: "references/a.md", content: big }])).not.toContain("S05");
  });
});

describe("S06 generic filenames", () => {
  it("fires on doc1.md / file2.md", () => {
    expect(idsFor([SKILL("[a](references/doc1.md)"), { path: "references/doc1.md", content: "x" }])).toContain("S06");
  });
  it("does not fire on a descriptive name", () => {
    expect(idsFor([SKILL("[a](references/api.md)"), { path: "references/api.md", content: "x" }])).not.toContain("S06");
  });
});

describe("S07 missing resources section", () => {
  it("fires when subdir content exists but no resources heading", () => {
    expect(idsFor([SKILL("Just a body."), { path: "references/a.md", content: "x" }])).toContain("S07");
  });
  it("does not fire when a resources heading exists", () => {
    expect(idsFor([SKILL("## Additional Resources\n[a](references/a.md)"), { path: "references/a.md", content: "x" }])).not.toContain("S07");
  });
});

describe("S12 undocumented scripts", () => {
  it("fires when a script is never referenced", () => {
    expect(idsFor([SKILL("No mention here."), { path: "scripts/run.py", content: "print(1)" }])).toContain("S12");
  });
  it("does not fire when the script path appears in the body", () => {
    expect(idsFor([SKILL("Run `scripts/run.py` first."), { path: "scripts/run.py", content: "print(1)" }])).not.toContain("S12");
  });
});
