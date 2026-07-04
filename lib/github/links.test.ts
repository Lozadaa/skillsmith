import { describe, it, expect } from "vitest";
import { extractRepoLinks } from "./links";

describe("extractRepoLinks", () => {
  it("extracts github repo links, dedupes, and keeps labels", () => {
    const md = `# Awesome Skills
- [PDF tools](https://github.com/anthropics/skills) — official
- [again](https://github.com/anthropics/skills)
- [cursor pack](https://github.com/other/pack/tree/main/skills)`;
    expect(extractRepoLinks(md)).toEqual([
      { owner: "anthropics", repo: "skills", label: "PDF tools" },
      { owner: "other", repo: "pack", label: "cursor pack" },
    ]);
  });

  it("ignores images, anchors, and non-github links", () => {
    const md = `![logo](https://github.com/x/y/raw/main/logo.png)
[jump](#section)
[docs](https://example.com/a/b)`;
    expect(extractRepoLinks(md)).toEqual([]);
  });

  it("caps the result at 100 links", () => {
    const md = Array.from({ length: 150 }, (_, i) => `[r${i}](https://github.com/o/repo${i})`).join("\n");
    expect(extractRepoLinks(md)).toHaveLength(100);
  });
});
