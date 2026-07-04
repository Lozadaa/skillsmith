import { describe, it, expect } from "vitest";
import { runRules } from "./engine";
import { mk } from "./util";
import type { ParsedSkill, Rule } from "../model";

const skill = {} as ParsedSkill; // rules below don't inspect the skill

const always = (id: string, severity: Rule["severity"], profiles?: Rule["profiles"]): Rule => ({
  id,
  severity,
  profiles,
  check: () => [mk(id, severity, "msg", "why", "fix")],
});

describe("runRules", () => {
  it("collects findings sorted by severity then rule id", () => {
    const rules = [always("S01", "suggestion"), always("E02", "error"), always("W01", "warning"), always("E01", "error")];
    const out = runRules(skill, rules, { profile: "generic" });
    expect(out.map((f) => f.ruleId)).toEqual(["E01", "E02", "W01", "S01"]);
  });

  it("filters rules by profile", () => {
    const rules = [always("W14", "warning", ["claude-code-plugin"]), always("E01", "error")];
    expect(runRules(skill, rules, { profile: "generic" }).map((f) => f.ruleId)).toEqual(["E01"]);
    expect(runRules(skill, rules, { profile: "claude-code-plugin" }).map((f) => f.ruleId)).toEqual(["E01", "W14"]);
  });

  it("isolates a crashing rule as an internal finding instead of throwing", () => {
    const bad: Rule = { id: "X99", severity: "error", check: () => { throw new Error("boom"); } };
    const out = runRules(skill, [bad], { profile: "generic" });
    expect(out).toHaveLength(1);
    expect(out[0].ruleId).toBe("X99");
    expect(out[0].message).toMatch(/internal error/i);
  });
});
