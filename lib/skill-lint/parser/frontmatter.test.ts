import { describe, it, expect } from "vitest";
import { extractFrontmatter } from "./frontmatter";

describe("extractFrontmatter", () => {
  it("parses a simple valid frontmatter", () => {
    const r = extractFrontmatter(`---\nname: my-skill\ndescription: Use when testing\n---\n# Body\n`);
    expect(r).not.toBeNull();
    expect(r!.frontmatter.data).toEqual({ name: "my-skill", description: "Use when testing" });
    expect(r!.frontmatter.parseError).toBeUndefined();
    expect(r!.bodyRaw).toBe("# Body\n");
    expect(r!.bodyStartLine).toBe(5);
  });

  it("returns null when line 1 is not ---", () => {
    expect(extractFrontmatter("# Just markdown\n")).toBeNull();
    expect(extractFrontmatter("name: no-delimiters\n")).toBeNull();
  });

  it("handles a BOM before ---", () => {
    const r = extractFrontmatter(`﻿---\nname: bom-skill\ndescription: x\n---\nbody`);
    expect(r).not.toBeNull();
    expect(r!.frontmatter.data["name"]).toBe("bom-skill");
  });

  it("parses block scalar descriptions", () => {
    const r = extractFrontmatter(`---\nname: multi\ndescription: |\n  Line one.\n  Line two.\n---\nbody`);
    expect(r!.frontmatter.data["description"]).toBe("Line one.\nLine two.\n");
  });

  it("reports unclosed frontmatter as parseError", () => {
    const r = extractFrontmatter(`---\nname: broken\ndescription: never closed\n`);
    expect(r).not.toBeNull();
    expect(r!.frontmatter.parseError?.message).toMatch(/unclosed/i);
  });

  it("recovers from unquoted colon-space in description (real-world ~1% failure)", () => {
    // Reproduces the verified failure from boraoztunc/adversarial-review
    const r = extractFrontmatter(
      `---\nname: adversarial-review\ndescription: Unlike normal code review: it leads with attacks\n---\nbody`
    );
    expect(r!.frontmatter.recovered).toBe(true);
    expect(r!.frontmatter.data["description"]).toBe("Unlike normal code review: it leads with attacks");
    expect(r!.frontmatter.fixedRaw).toContain('"Unlike normal code review: it leads with attacks"');
  });

  it("records duplicate keys with mixed case, last wins", () => {
    // Reproduces alirezarezvani/claude-coach: Name: + name:
    const r = extractFrontmatter(`---\nName: claude-coach\nname: claude-coach\ndescription: x\n---\nbody`);
    const keys = r!.frontmatter.keyOccurrences.map((k) => k.key);
    expect(keys).toContain("Name");
    expect(keys).toContain("name");
    expect(r!.frontmatter.data["name"]).toBe("claude-coach");
  });

  it("reports non-mapping frontmatter as parseError, never throws", () => {
    const r = extractFrontmatter(`---\njust a scalar\n---\nbody`);
    expect(r!.frontmatter.parseError?.message).toMatch(/mapping/i);
  });

  it("reports the correct 1-based line for an unrecoverable YAML error", () => {
    const r = extractFrontmatter(`---\nname: ok\nbroken: [unterminated flow seq\n---\nbody`);
    expect(r).not.toBeNull();
    expect(r!.frontmatter.parseError).toBeDefined();
    expect(r!.frontmatter.parseError!.line).toBe(3);
  });

  it("parses CRLF frontmatter and body boundary", () => {
    const r = extractFrontmatter("---\r\nname: crlf-skill\r\ndescription: Use when testing CRLF\r\n---\r\n# Body\r\n");
    expect(r).not.toBeNull();
    expect(r!.frontmatter.data["name"]).toBe("crlf-skill");
    expect(r!.bodyRaw).not.toContain("\r");
  });
});
