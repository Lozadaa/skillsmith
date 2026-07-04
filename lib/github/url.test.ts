import { describe, it, expect } from "vitest";
import { parseGitHubUrl } from "./url";

describe("parseGitHubUrl", () => {
  it("parses a plain repo URL", () => {
    expect(parseGitHubUrl("https://github.com/mattpocock/skills")).toEqual({
      kind: "repo",
      owner: "mattpocock",
      repo: "skills",
    });
  });

  it("parses http, www, and trailing slash", () => {
    expect(parseGitHubUrl("http://www.github.com/o/r/")).toEqual({ kind: "repo", owner: "o", repo: "r" });
  });

  it("strips a trailing .git", () => {
    expect(parseGitHubUrl("https://github.com/o/r.git")).toEqual({ kind: "repo", owner: "o", repo: "r" });
  });

  it("parses a bare owner/repo shorthand", () => {
    expect(parseGitHubUrl("facebook/react")).toEqual({ kind: "repo", owner: "facebook", repo: "react" });
  });

  it("parses tree URLs with ref and subPath", () => {
    expect(parseGitHubUrl("https://github.com/o/r/tree/main/skills/foo")).toEqual({
      kind: "repo",
      owner: "o",
      repo: "r",
      ref: "main",
      subPath: "skills/foo",
    });
  });

  it("parses tree URLs with ref but no subPath", () => {
    expect(parseGitHubUrl("https://github.com/o/r/tree/develop")).toEqual({
      kind: "repo",
      owner: "o",
      repo: "r",
      ref: "develop",
    });
  });

  it("parses blob URLs (ref + file path as subPath)", () => {
    expect(parseGitHubUrl("https://github.com/o/r/blob/main/skills/foo/SKILL.md")).toEqual({
      kind: "repo",
      owner: "o",
      repo: "r",
      ref: "main",
      subPath: "skills/foo/SKILL.md",
    });
  });

  it("ignores unknown trailing paths and resolves the repo root", () => {
    expect(parseGitHubUrl("https://github.com/o/r/issues/42")).toEqual({ kind: "repo", owner: "o", repo: "r" });
  });

  it("drops query strings and fragments", () => {
    expect(parseGitHubUrl("https://github.com/o/r?tab=readme#top")).toEqual({ kind: "repo", owner: "o", repo: "r" });
  });

  it("parses gist URLs with a user segment", () => {
    expect(parseGitHubUrl("https://gist.github.com/someone/abc123def456")).toEqual({
      kind: "gist",
      gistId: "abc123def456",
    });
  });

  it("parses gist URLs without a user segment", () => {
    expect(parseGitHubUrl("gist.github.com/abc123")).toEqual({ kind: "gist", gistId: "abc123" });
  });

  it("returns null for empty, host-only, single-segment, and non-github hosts", () => {
    expect(parseGitHubUrl("")).toBeNull();
    expect(parseGitHubUrl("   ")).toBeNull();
    expect(parseGitHubUrl("https://github.com")).toBeNull();
    expect(parseGitHubUrl("react")).toBeNull();
    expect(parseGitHubUrl("https://example.com/o/r")).toBeNull();
  });
});
