import { describe, it, expect } from "vitest";
import { zipSkill, unzipSkill, zipCollection } from "./zip";
import type { SkillFile } from "./skill-lint/model";

const FILES: SkillFile[] = [
  { path: "SKILL.md", content: "---\nname: demo\ndescription: x\n---\nbody" },
  { path: "references/api.md", content: "reference content" },
];

describe("zipSkill / unzipSkill round trip", () => {
  it("prefixes entries with rootDir and restores them stripped", () => {
    const bytes = zipSkill(FILES, "demo");
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(0);
    const back = unzipSkill(bytes);
    const byPath = Object.fromEntries(back.map((f) => [f.path, f.content]));
    expect(new Set(Object.keys(byPath))).toEqual(new Set(["SKILL.md", "references/api.md"]));
    expect(byPath["SKILL.md"]).toBe(FILES[0].content);
    expect(byPath["references/api.md"]).toBe(FILES[1].content);
  });

  it("preserves UTF-8 content including CJK", () => {
    const cjk: SkillFile[] = [{ path: "SKILL.md", content: "研究深度研究文獻回顧檢索" }];
    const back = unzipSkill(zipSkill(cjk, "cjk-skill"));
    expect(back[0].content).toBe("研究深度研究文獻回顧檢索");
  });
});

describe("unzipSkill root handling", () => {
  it("strips a single shared root directory", () => {
    const bytes = zipSkill(FILES, "my-skill"); // entries: my-skill/SKILL.md, my-skill/references/api.md
    const back = unzipSkill(bytes);
    expect(back.map((f) => f.path).sort()).toEqual(["SKILL.md", "references/api.md"]);
  });

  it("does not strip when entries do not share one common root", () => {
    // Hand-build a two-root zip via zipSkill on already-rooted paths.
    const mixed: SkillFile[] = [
      { path: "a/SKILL.md", content: "1" },
      { path: "b/other.md", content: "2" },
    ];
    const bytes = zipSkill(mixed, ""); // rootDir "" → entries keep a/... and b/...
    const back = unzipSkill(bytes);
    expect(back.map((f) => f.path).sort()).toEqual(["a/SKILL.md", "b/other.md"]);
  });
});

describe("zipCollection", () => {
  it("nests each group under skills/<name>/ and round-trips via unzipSkill-free reading", () => {
    const bytes = zipCollection([
      { name: "alpha", files: [{ path: "SKILL.md", content: "a" }, { path: "references/x.md", content: "ax" }] },
      { name: "beta", files: [{ path: "SKILL.md", content: "b" }] },
    ]);
    expect(bytes).toBeInstanceOf(Uint8Array);
    // Re-read with fflate to assert the entry layout.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { unzipSync, strFromU8 } = require("fflate") as typeof import("fflate");
    const raw = unzipSync(bytes);
    const keys = Object.keys(raw).sort();
    expect(keys).toEqual(["skills/alpha/SKILL.md", "skills/alpha/references/x.md", "skills/beta/SKILL.md"]);
    expect(strFromU8(raw["skills/alpha/references/x.md"])).toBe("ax");
  });
});
