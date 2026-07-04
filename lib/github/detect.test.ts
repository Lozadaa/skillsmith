import { describe, it, expect } from "vitest";
import { detectSkills } from "./detect";
import type { TreeEntry } from "./client";

/** Minimal tree-entry builder. mode defaults to a regular file. */
function e(path: string, mode = "100644", type: TreeEntry["type"] = "blob"): TreeEntry {
  return { path, mode, type, sha: "sha-" + path };
}

describe("layout (b): boraoztunc flat root dirs", () => {
  it("detects one skill per top-level directory as skills-dir", () => {
    const d = detectSkills(
      [e("adversarial-review/SKILL.md"), e("adversarial-review/reference.md"), e("code-golf/SKILL.md")],
      { repoName: "skills" }
    );
    expect(d.mode).toBe("skills");
    if (d.mode !== "skills") return;
    expect(d.skills.map((s) => [s.name, s.origin, s.dirPath])).toEqual([
      ["adversarial-review", "skills-dir", "adversarial-review"],
      ["code-golf", "skills-dir", "code-golf"],
    ]);
  });
});

describe("layout (a): jezweb marketplace with plugin.json under plugin dirs", () => {
  it("attributes skills to their nearest plugin.json directory", () => {
    const d = detectSkills(
      [
        e(".claude-plugin/marketplace.json"),
        e("plugins/seo-pack/plugin.json"),
        e("plugins/seo-pack/skills/meta-tags/SKILL.md"),
        e("plugins/seo-pack/skills/sitemaps/SKILL.md"),
      ],
      { repoName: "marketplace" }
    );
    if (d.mode !== "skills") throw new Error("expected skills");
    expect(d.skills.map((s) => [s.name, s.origin, s.pluginName])).toEqual([
      ["meta-tags", "plugin", "seo-pack"],
      ["sitemaps", "plugin", "seo-pack"],
    ]);
  });
});

describe("layout (c): mattpocock skills/<category>/<name>", () => {
  it("classifies deep skills/ nesting as category-dir and shallow as skills-dir", () => {
    const d = detectSkills(
      [e("skills/testing/vitest-setup/SKILL.md"), e("skills/formatting/SKILL.md")],
      { repoName: "skills" }
    );
    if (d.mode !== "skills") throw new Error("expected skills");
    expect(d.skills.map((s) => [s.name, s.origin])).toEqual([
      ["vitest-setup", "category-dir"],
      ["formatting", "skills-dir"],
    ]);
  });

  it("classifies harness dirs as harness-dir", () => {
    const d = detectSkills([e(".cursor/skills/foo/SKILL.md"), e(".github/skills/bar/SKILL.md")]);
    if (d.mode !== "skills") throw new Error("expected skills");
    expect(d.skills.map((s) => s.origin)).toEqual(["harness-dir", "harness-dir"]);
  });
});

describe("layout (d): monorepo with .codex symlink aliases (mode 120000)", () => {
  it("keeps the canonical skill and drops the symlink mirror", () => {
    const d = detectSkills([
      e(".claude/skills/git-helper/SKILL.md"),
      e(".claude/skills/git-helper/reference.md"),
      e(".codex/skills/git-helper/SKILL.md", "120000"), // file-level alias of the canonical SKILL.md
    ]);
    if (d.mode !== "skills") throw new Error("expected skills");
    expect(d.skills).toHaveLength(1);
    expect(d.skills[0]).toMatchObject({ name: "git-helper", origin: "harness-dir", viaSymlink: false });
  });

  it("flags a skill reachable only via a symlink alias", () => {
    const d = detectSkills([e(".codex/skills/orphan/SKILL.md", "120000")]);
    if (d.mode !== "skills") throw new Error("expected skills");
    expect(d.skills[0]).toMatchObject({ name: "orphan", viaSymlink: true });
  });
});

describe("layout root single skill", () => {
  it("uses the repo name and origin root", () => {
    const d = detectSkills([e("SKILL.md"), e("references/api.md")], { repoName: "my-skill" });
    if (d.mode !== "skills") throw new Error("expected skills");
    expect(d.skills[0]).toMatchObject({ dirPath: "", name: "my-skill", origin: "root", viaSymlink: false });
  });
});

describe("layout case variants", () => {
  it("imports skill.md variants and prefers exact SKILL.md when both exist in a dir", () => {
    const variant = detectSkills([e("foo/skill.md")]);
    if (variant.mode !== "skills") throw new Error("expected skills");
    expect(variant.skills).toHaveLength(1);
    expect(variant.skills[0].name).toBe("foo");

    const both = detectSkills([e("bar/SKILL.md"), e("bar/skill.md")]);
    if (both.mode !== "skills") throw new Error("expected skills");
    expect(both.skills).toHaveLength(1);
    expect(both.skills[0].dirPath).toBe("bar");
  });
});

describe("layout (e): awesome-list repo with zero SKILL.md", () => {
  it("returns links mode so the caller parses the README", () => {
    const d = detectSkills([e("README.md"), e("CONTRIBUTING.md"), e("LICENSE")], { repoName: "awesome-skills" });
    expect(d.mode).toBe("links");
  });
});

describe("layout (f): truncated tree still detects what is present", () => {
  it("detects skills from a partial (truncated) entry list", () => {
    // Truncation is a client-level flag; detect operates on whatever entries arrived.
    const d = detectSkills([e("skills/one/SKILL.md")], { repoName: "big" });
    if (d.mode !== "skills") throw new Error("expected skills");
    expect(d.skills).toHaveLength(1);
  });
});

describe("layout 5: subPath filter (direct /tree/main/skills/foo URL)", () => {
  it("restricts detection to entries under subPath", () => {
    const d = detectSkills(
      [e("skills/foo/SKILL.md"), e("skills/bar/SKILL.md")],
      { repoName: "r", subPath: "skills/foo" }
    );
    if (d.mode !== "skills") throw new Error("expected skills");
    expect(d.skills.map((s) => s.name)).toEqual(["foo"]);
  });

  it("supports a subPath that points directly at a SKILL.md (blob URL)", () => {
    const d = detectSkills(
      [e("skills/foo/SKILL.md"), e("skills/bar/SKILL.md")],
      { repoName: "r", subPath: "skills/foo/SKILL.md" }
    );
    if (d.mode !== "skills") throw new Error("expected skills");
    expect(d.skills.map((s) => s.name)).toEqual(["foo"]);
  });
});
