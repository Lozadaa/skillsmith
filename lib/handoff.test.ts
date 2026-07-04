import { describe, it, expect } from "vitest";
import { stashIncomingSkill, takeIncomingSkill } from "./handoff";
import type { SkillFile } from "./skill-lint/model";

/** Minimal in-memory Storage stub so this stays a node test. */
function makeStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    key: (i: number) => Array.from(m.keys())[i] ?? null,
    removeItem: (k: string) => void m.delete(k),
    setItem: (k: string, v: string) => void m.set(k, v),
  } as Storage;
}

const FILES: SkillFile[] = [{ path: "SKILL.md", content: "---\nname: x\n---\nbody" }];

describe("stash / take incoming skill", () => {
  it("round-trips files, dirName and source", () => {
    const s = makeStorage();
    stashIncomingSkill(FILES, { dirName: "my-skill", source: "wizard" }, s);
    const got = takeIncomingSkill(s);
    expect(got).toEqual({ files: FILES, dirName: "my-skill", source: "wizard" });
  });

  it("removes the key after reading (single-use)", () => {
    const s = makeStorage();
    stashIncomingSkill(FILES, {}, s);
    expect(takeIncomingSkill(s)).not.toBeNull();
    expect(takeIncomingSkill(s)).toBeNull();
  });

  it("returns null when nothing was stashed", () => {
    expect(takeIncomingSkill(makeStorage())).toBeNull();
  });

  it("returns null and does not throw on corrupt JSON", () => {
    const s = makeStorage();
    s.setItem("skillsmith:incoming", "{not json");
    expect(() => takeIncomingSkill(s)).not.toThrow();
    expect(takeIncomingSkill(s)).toBeNull();
  });

  it("swallows quota errors on write (non-fatal)", () => {
    const throwing = {
      ...makeStorage(),
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    } as Storage;
    expect(() => stashIncomingSkill(FILES, {}, throwing)).not.toThrow();
  });
});
