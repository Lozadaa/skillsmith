import { describe, it, expect } from "vitest";
import { parseBody } from "./markdown";

describe("parseBody", () => {
  it("extracts headings with depth and 1-based line numbers", () => {
    const b = parseBody("# Title\n\n## Section\ntext", 5);
    expect(b.headings).toEqual([
      { depth: 1, text: "Title", line: 5 },
      { depth: 2, text: "Section", line: 7 },
    ]);
  });

  it("excludes fenced code blocks from proseLines and headings", () => {
    const b = parseBody("prose\n```\n# not a heading\nyou should ignore this\n```\nafter", 1);
    expect(b.headings).toHaveLength(0);
    expect(b.proseLines.map((l) => l.text)).toEqual(["prose", "after"]);
  });

  it("extracts relative markdown links and backtick paths", () => {
    const b = parseBody("See [api](references/api.md) and `scripts/run.py` and [ext](https://x.com)", 1);
    expect(b.links).toEqual([
      { target: "references/api.md", line: 1, kind: "link" },
      { target: "https://x.com", line: 1, kind: "link" },
      { target: "scripts/run.py", line: 1, kind: "path" },
    ]);
  });

  it("counts words", () => {
    expect(parseBody("one two  three\nfour", 1).wordCount).toBe(4);
  });

  it("parses headings in CRLF content", () => {
    const b = parseBody("# Title\r\n\r\n## Second\r\ntext", 1);
    expect(b.headings.map((h) => h.text)).toEqual(["Title", "Second"]);
  });
});
