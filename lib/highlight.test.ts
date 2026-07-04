import { describe, it, expect } from "vitest";
import { highlightSkillMd } from "./highlight";

function joined(source: string): string {
  return highlightSkillMd(source)
    .map((t) => t.text)
    .join("");
}

const FIXTURE = `---
name: my-skill
description: Use when testing the highlighter
---
# Heading One

Some text with a [link](https://example.com) and \`inline code\`.

\`\`\`ts
const x = 1;
\`\`\`

- list item one
1. list item two
`;

describe("highlightSkillMd — losslessness", () => {
  it("reproduces the fixture source exactly by concatenating token text", () => {
    expect(joined(FIXTURE)).toBe(FIXTURE);
  });

  it("reproduces a frontmatter-only source exactly", () => {
    const src = "---\nname: x\ndescription: y\n---\n";
    expect(joined(src)).toBe(src);
  });

  it("reproduces plain markdown (no frontmatter) exactly", () => {
    const src = "# Title\n\nJust some body text.\n";
    expect(joined(src)).toBe(src);
  });

  it("reproduces a source with no trailing newline exactly", () => {
    const src = "---\nname: x\ndescription: y\n---\n# Body\nNo trailing newline";
    expect(joined(src)).toBe(src);
  });

  it("reproduces a source with multiple fences and links exactly", () => {
    const src =
      "Text before.\n\n~~~js\ncode here\n~~~\n\nMore [a](b) and [c](d) text.\n\n```\nfenced\n```\n";
    expect(joined(src)).toBe(src);
  });

  it("reproduces an empty source exactly", () => {
    expect(joined("")).toBe("");
  });
});

describe("highlightSkillMd — kind assignment", () => {
  it("tags the opening and closing --- as fm-delim", () => {
    const tokens = highlightSkillMd("---\nname: x\ndescription: y\n---\nbody\n");
    const delims = tokens.filter((t) => t.kind === "fm-delim");
    expect(delims.length).toBe(2);
    expect(delims[0]!.text).toBe("---\n");
    expect(delims[1]!.text).toBe("---\n");
  });

  it("tags `name:` as fm-key inside frontmatter", () => {
    const tokens = highlightSkillMd("---\nname: my-skill\ndescription: y\n---\nbody\n");
    const keyToken = tokens.find((t) => t.kind === "fm-key" && t.text === "name:");
    expect(keyToken).toBeDefined();
  });

  it("tags a value-only line inside frontmatter as fm-value when it has no key prefix", () => {
    const tokens = highlightSkillMd("---\nname: x\ndescription: |\n  continued line\n---\nbody\n");
    const continued = tokens.find((t) => t.kind === "fm-value" && t.text.includes("continued line"));
    expect(continued).toBeDefined();
  });

  it("tags an ATX heading line as heading", () => {
    const tokens = highlightSkillMd("# Title\n\nbody\n");
    const heading = tokens.find((t) => t.kind === "heading");
    expect(heading).toBeDefined();
    expect(heading!.text).toContain("# Title");
  });

  it("toggles fence state so content inside ``` fences is tagged code, not fence", () => {
    const src = "```\nconst x = 1;\n```\n";
    const tokens = highlightSkillMd(src);
    const fenceTokens = tokens.filter((t) => t.kind === "fence");
    const codeTokens = tokens.filter((t) => t.kind === "code");
    expect(fenceTokens.length).toBe(2);
    expect(codeTokens.some((t) => t.text.includes("const x = 1;"))).toBe(true);
  });

  it("tags a markdown link as a single link token", () => {
    const tokens = highlightSkillMd("See [text](target) here.\n");
    const link = tokens.find((t) => t.kind === "link");
    expect(link).toBeDefined();
    expect(link!.text).toBe("[text](target)");
  });

  it("tags inline code spans as code", () => {
    const tokens = highlightSkillMd("Use `inline code` here.\n");
    const inline = tokens.find((t) => t.kind === "code" && t.text === "`inline code`");
    expect(inline).toBeDefined();
  });

  it("tags list markers as list tokens", () => {
    const tokens = highlightSkillMd("- item one\n1. item two\n");
    const listTokens = tokens.filter((t) => t.kind === "list");
    expect(listTokens.length).toBe(2);
    expect(listTokens[0]!.text).toBe("-");
    expect(listTokens[1]!.text).toBe("1.");
  });
});

describe("highlightSkillMd — CRLF tolerance", () => {
  const CRLF_FIXTURE =
    "---\r\nname: my-skill\r\ndescription: Use when testing CRLF\r\n---\r\n# Heading One\r\n\r\n```ts\r\nconst x = 1;\r\n```\r\n";

  it("stays lossless on CRLF input", () => {
    expect(joined(CRLF_FIXTURE)).toBe(CRLF_FIXTURE);
  });

  it("still tags name: as fm-key when the file uses CRLF line endings", () => {
    const tokens = highlightSkillMd(CRLF_FIXTURE);
    const keyToken = tokens.find((t) => t.kind === "fm-key" && t.text === "name:");
    expect(keyToken).toBeDefined();
  });

  it("still recognizes both frontmatter delimiters with CRLF line endings", () => {
    const tokens = highlightSkillMd(CRLF_FIXTURE);
    const delims = tokens.filter((t) => t.kind === "fm-delim");
    expect(delims.length).toBe(2);
  });

  it("still tags the heading line with CRLF line endings", () => {
    const tokens = highlightSkillMd(CRLF_FIXTURE);
    const heading = tokens.find((t) => t.kind === "heading");
    expect(heading).toBeDefined();
    expect(heading!.text).toContain("# Heading One");
  });
});

describe("highlightSkillMd — inline scan bail-out on pathological lines", () => {
  it("tokenizes a 50,000-char unmatched-bracket line quickly as a single text token", () => {
    const pathological = "[".repeat(50_000) + "\n";
    const start = performance.now();
    const tokens = highlightSkillMd(pathological);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(250);
    expect(tokens.length).toBe(1);
    expect(tokens[0]!.kind).toBe("text");
    expect(tokens[0]!.text).toBe(pathological);
  });
});
