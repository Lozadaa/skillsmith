import { describe, it, expect } from "vitest";
import { warningFrontmatterRules, GENERIC_ALLOWED_KEYS, PLUGIN_ALLOWED_KEYS } from "./warnings-frontmatter";
import { runRules } from "./engine";
import { parseSkill } from "../parser/skill";
import type { ParsedSkill, Profile } from "../model";

function build(fm: string): ParsedSkill {
  const r = parseSkill([{ path: "SKILL.md", content: `---\n${fm}\n---\nBody` }]);
  if (r.kind !== "skill") throw new Error("fixture is not a skill: " + r.reason);
  return r.skill;
}
function idsFor(fm: string, profile: Profile = "generic"): string[] {
  return runRules(build(fm), warningFrontmatterRules, { profile }).map((f) => f.ruleId);
}

describe("allowlists", () => {
  it("plugin allowlist is a superset of generic and keeps allowed-tools", () => {
    for (const k of GENERIC_ALLOWED_KEYS) expect(PLUGIN_ALLOWED_KEYS).toContain(k);
    expect(PLUGIN_ALLOWED_KEYS).toContain("allowed-tools");
    expect(PLUGIN_ALLOWED_KEYS).toContain("argument-hint");
  });
});

describe("W12 unknown frontmatter field", () => {
  it("fires on an unknown key", () => {
    expect(idsFor("name: a-b\ndescription: Use when testing\nauthr: me")).toContain("W12");
  });
  it("does not fire on allowed keys", () => {
    expect(idsFor("name: a-b\ndescription: Use when testing\nlicense: MIT")).not.toContain("W12");
  });
  it("does not fire on when_to_use (W13 owns it)", () => {
    const ids = idsFor("name: a-b\ndescription: Use when testing\nwhen_to_use: later");
    expect(ids).not.toContain("W12");
    expect(ids).toContain("W13");
  });
});

describe("W13 deprecated when_to_use", () => {
  it("fires regardless of case", () => {
    expect(idsFor("name: a-b\ndescription: Use when testing\nWhen_To_Use: later")).toContain("W13");
  });
  it("does not fire when absent", () => {
    expect(idsFor("name: a-b\ndescription: Use when testing")).not.toContain("W13");
  });
});

describe("W14 allowed-tools in plugin profile", () => {
  it("fires only under the claude-code-plugin profile", () => {
    const fm = "name: a-b\ndescription: Use when testing\nallowed-tools: Bash";
    expect(idsFor(fm, "generic")).not.toContain("W14");
    expect(idsFor(fm, "claude-code-plugin")).toContain("W14");
  });
});

describe("W15 duplicate / mixed-case keys", () => {
  it("fires on mixed-case duplicate keys", () => {
    expect(idsFor("Name: a-b\nname: a-b\ndescription: Use when testing")).toContain("W15");
  });
  it("does not fire for a duplicate description (E05 owns it)", () => {
    expect(idsFor("name: a-b\ndescription: one\ndescription: two")).not.toContain("W15");
  });
});
