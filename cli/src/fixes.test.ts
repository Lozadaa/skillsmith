import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Finding } from "../../lib/skill-lint";
import type { AnalyzedSkill } from "./analyze";
import { previewFix, commitFix } from "./fixes";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "skillsmith-fix-"));
  writeFileSync(join(dir, "SKILL.md"), "before");
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const skill = (): AnalyzedSkill => ({
  dirName: "x",
  dir,
  files: [{ path: "SKILL.md", content: "before" }],
  outcome: { kind: "not-a-skill", reason: "stub" },
});

const findingWith = (apply: Finding["fix"]): Finding => ({
  ruleId: "T",
  severity: "warning",
  message: "m",
  why: "w",
  howToFix: "h",
  fix: apply,
});

describe("previewFix", () => {
  it("returns null when the finding has no fix", () => {
    expect(previewFix(skill(), findingWith(undefined))).toBeNull();
  });

  it("reports only the files whose content changes", () => {
    const f = findingWith({
      label: "replace body",
      apply: (files) => files.map((x) => (x.path === "SKILL.md" ? { ...x, content: "after" } : x)),
    });
    const preview = previewFix(skill(), f)!;
    expect(preview.changed).toEqual(["SKILL.md"]);
    expect(preview.label).toBe("replace body");
  });

  it("reports no change when the fix is a no-op", () => {
    const f = findingWith({ label: "noop", apply: (files) => files });
    expect(previewFix(skill(), f)!.changed).toEqual([]);
  });
});

describe("commitFix", () => {
  it("writes the changed files to disk", () => {
    const f = findingWith({
      label: "replace",
      apply: (files) => files.map((x) => ({ ...x, content: "after" })),
    });
    const s = skill();
    const preview = previewFix(s, f)!;
    commitFix(s, preview, "generic");
    expect(readFileSync(join(dir, "SKILL.md"), "utf8")).toBe("after");
  });
});
