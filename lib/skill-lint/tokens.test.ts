import { describe, it, expect } from "vitest";
import { estimateTokens, tokenReport } from "./tokens";
import type { ParsedSkill } from "./model";

describe("estimateTokens", () => {
  it("returns 0 for empty text", () => {
    expect(estimateTokens("")).toBe(0);
  });

  it("estimates ~chars/3.5 for ASCII text", () => {
    const text = "a".repeat(350);
    expect(estimateTokens(text)).toBe(100);
  });

  it("counts CJK characters as ~1 token each", () => {
    // 10 CJK chars ≈ 10 tokens (vs 10/3.5 ≈ 3 if treated as ASCII)
    expect(estimateTokens("研究深度研究文獻回顧檢索")).toBeGreaterThanOrEqual(10);
  });
});

describe("tokenReport", () => {
  const skill = {
    dirName: "demo",
    filenameAsGiven: "SKILL.md",
    skillFile: { path: "SKILL.md", content: "" },
    frontmatter: {
      raw: "",
      data: { name: "demo-skill", description: "Use when testing token math" },
      keyOccurrences: [],
    },
    body: {
      raw: "Body text here with several words in it",
      lines: [],
      proseLines: [],
      headings: [],
      links: [],
      wordCount: 8,
    },
    files: [
      { path: "SKILL.md", content: "" },
      { path: "references/api.md", content: "reference content ".repeat(50) },
      { path: "scripts/run.py", content: "print('hi')" },
    ],
  } as unknown as ParsedSkill;

  it("splits metadata / body / references and counts script files", () => {
    const r = tokenReport(skill);
    expect(r.metadata).toBeGreaterThan(0);
    expect(r.body).toBeGreaterThan(0);
    expect(r.references).toBeGreaterThan(0);
    expect(r.scriptFiles).toBe(1);
    expect(r.total).toBe(r.metadata + r.body + r.references);
  });
});
