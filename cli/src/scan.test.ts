import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { listSkillDirs, readSkillFiles, resolveSources } from "./scan";

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "skillsmith-scan-"));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

const write = (p: string, c: string) => {
  mkdirSync(join(root, p, ".."), { recursive: true });
  writeFileSync(join(root, p), c);
};

describe("listSkillDirs", () => {
  it("finds only folders that contain a SKILL.md, alphabetically", () => {
    write("alpha/SKILL.md", "# a");
    write("beta/README.md", "not a skill");
    write("gamma/skill.md", "# g (lowercase counts)");
    const dirs = listSkillDirs(root).map((d) => d.dirName);
    expect(dirs).toEqual(["alpha", "gamma"]);
  });
});

describe("readSkillFiles", () => {
  it("reads all files with relative '/' paths, sorted", () => {
    write("s/SKILL.md", "# s");
    write("s/references/api.md", "ref");
    write("s/scripts/run.py", "print(1)");
    const files = readSkillFiles(join(root, "s")).map((f) => f.path);
    expect([...files].sort()).toEqual(["SKILL.md", "references/api.md", "scripts/run.py"].sort());
  });

  it("skips files over the size cap and empties binary content", () => {
    write("s/SKILL.md", "# s");
    writeFileSync(join(root, "s", "big.txt"), "x".repeat(2 * 1024 * 1024 + 1));
    writeFileSync(join(root, "s", "logo.png"), Buffer.from([0x89, 0x50, 0x00, 0x01, 0x02]));
    const files = readSkillFiles(join(root, "s"));
    expect(files.find((f) => f.path === "big.txt")).toBeUndefined();
    expect(files.find((f) => f.path === "logo.png")?.content).toBe("");
  });
});

describe("listSkillDirs — root itself is a skill", () => {
  it("includes the root when a custom path points straight at one skill folder", () => {
    write("solo/SKILL.md", "# solo");
    const dirs = listSkillDirs(join(root, "solo")).map((d) => d.dirName);
    expect(dirs).toContain("solo");
  });
});

describe("resolveSources", () => {
  it("uses --path when the directory exists, and nothing when it doesn't", () => {
    expect(resolveSources(process.cwd(), root)).toEqual([{ id: "path", label: root, root }]);
    expect(resolveSources(process.cwd(), join(root, "nope"))).toEqual([]);
  });
});
