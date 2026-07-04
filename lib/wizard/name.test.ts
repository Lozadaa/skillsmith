import { describe, it, expect } from "vitest";
import { validateName } from "./name";

describe("validateName", () => {
  it("accepts kebab-case names", () => {
    expect(validateName("processing-pdfs")).toEqual({ ok: true });
    expect(validateName("a1")).toEqual({ ok: true });
  });
  it.each([
    ["", /kebab-case/i],
    ["MySkill", /kebab-case/i],
    ["-lead", /kebab-case/i],
    ["a--b", /kebab-case/i],
    ["a_b", /kebab-case/i],
  ])("rejects %s", (name, re) => {
    const r = validateName(name);
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(re);
  });
  it("rejects reserved words with the engine's wording", () => {
    expect(validateName("claude-helper").message).toMatch(/reserved word/i);
    expect(validateName("anthropic-tools").message).toMatch(/reserved word/i);
  });
  it("rejects names over 64 chars", () => {
    expect(validateName("a".repeat(65)).message).toMatch(/64/);
  });
});
