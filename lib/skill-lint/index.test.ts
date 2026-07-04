import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { lintSkill } from "./index";
import {
  BROKEN_YAML_COLON,
  DUP_MIXED_KEYS,
  NO_FRONTMATTER,
  SYMLINK_DEGRADED,
  KITCHEN_SINK_BAD,
} from "./fixtures/fixtures";

const FIX = join(__dirname, "fixtures");

function loadValidFull() {
  return [
    { path: "SKILL.md", content: readFileSync(join(FIX, "valid-full/SKILL.md"), "utf8") },
    { path: "references/api.md", content: readFileSync(join(FIX, "valid-full/references/api.md"), "utf8") },
    { path: "scripts/run.py", content: readFileSync(join(FIX, "valid-full/scripts/run.py"), "utf8") },
  ];
}

describe("lintSkill end to end", () => {
  it("valid-full fixture: zero errors, score >= 90, token breakdown present", () => {
    const r = lintSkill(loadValidFull(), { dirName: "valid-full" });
    expect(r.kind).toBe("skill");
    if (r.kind === "skill") {
      expect(r.findings.filter((f) => f.severity === "error")).toEqual([]);
      expect(r.score.value).toBeGreaterThanOrEqual(90);
      expect(r.tokens.metadata).toBeGreaterThan(0);
      expect(r.tokens.references).toBeGreaterThan(0);
      expect(r.tokens.scriptFiles).toBe(1);
    }
  });

  it("broken-yaml-colon: E12 with an autofix that clears the error", () => {
    const r = lintSkill(BROKEN_YAML_COLON);
    if (r.kind !== "skill") throw new Error(r.reason);
    const e12 = r.findings.find((f) => f.ruleId === "E12");
    expect(e12?.fix).toBeDefined();
    const again = lintSkill(e12!.fix!.apply(BROKEN_YAML_COLON));
    if (again.kind !== "skill") throw new Error("fix broke the skill");
    expect(again.findings.map((f) => f.ruleId)).not.toContain("E12");
  });

  it("dup-mixed-keys: parses with last-wins", () => {
    const r = lintSkill(DUP_MIXED_KEYS);
    expect(r.kind).toBe("skill");
    if (r.kind === "skill") expect(r.skill.frontmatter.data["name"]).toBe("claude-coach");
  });

  it("no-frontmatter and symlink fixtures: not-a-skill, never a crash", () => {
    expect(lintSkill(NO_FRONTMATTER).kind).toBe("not-a-skill");
    expect(lintSkill(SYMLINK_DEGRADED).kind).toBe("not-a-skill");
  });

  it("kitchen-sink: fires E02, E05, E07, E08, E09, E11 and scores poor", () => {
    const r = lintSkill(KITCHEN_SINK_BAD);
    if (r.kind !== "skill") throw new Error(r.reason);
    const ids = new Set(r.findings.map((f) => f.ruleId));
    for (const expected of ["E02", "E05", "E07", "E08", "E09", "E11"]) {
      expect(ids).toContain(expected);
    }
    expect(r.score.value).toBeLessThan(40);
    expect(r.score.band).toBe("poor");
  });
});
