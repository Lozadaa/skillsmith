import { describe, it, expect } from "vitest";
import { workspaceReducer, type WorkspaceState } from "./useWorkspace";
import type { Finding, SkillFile } from "@/lib/skill-lint";

const base: WorkspaceState = {
  files: [
    { path: "SKILL.md", content: "---\nname: demo\ndescription: x\n---\nbody" },
    { path: "references/api.md", content: "ref" },
  ],
  activePath: "SKILL.md",
  dirName: "demo",
};

describe("workspaceReducer", () => {
  it("loadFiles replaces files, dirName and picks SKILL.md active", () => {
    const next = workspaceReducer(base, {
      type: "loadFiles",
      files: [{ path: "SKILL.md", content: "new" }],
      dirName: "other",
    });
    expect(next.files).toHaveLength(1);
    expect(next.dirName).toBe("other");
    expect(next.activePath).toBe("SKILL.md");
  });

  it("editActive only mutates the active file", () => {
    const next = workspaceReducer(base, { type: "editActive", content: "edited" });
    expect(next.files.find((f) => f.path === "SKILL.md")!.content).toBe("edited");
    expect(next.files.find((f) => f.path === "references/api.md")!.content).toBe("ref");
  });

  it("selectFile switches active only to an existing path", () => {
    expect(workspaceReducer(base, { type: "selectFile", path: "references/api.md" }).activePath).toBe(
      "references/api.md"
    );
    expect(workspaceReducer(base, { type: "selectFile", path: "nope.md" }).activePath).toBe("SKILL.md");
  });

  it("addFile appends a blank file and focuses it; ignores dupes/blank", () => {
    const added = workspaceReducer(base, { type: "addFile", path: "scripts/run.py" });
    expect(added.files.map((f) => f.path)).toContain("scripts/run.py");
    expect(added.activePath).toBe("scripts/run.py");
    expect(workspaceReducer(base, { type: "addFile", path: "SKILL.md" }).files).toHaveLength(2);
    expect(workspaceReducer(base, { type: "addFile", path: "  " }).files).toHaveLength(2);
  });

  it("deleteFile removes a file but never SKILL.md, and refocuses", () => {
    const del = workspaceReducer(
      { ...base, activePath: "references/api.md" },
      { type: "deleteFile", path: "references/api.md" }
    );
    expect(del.files.map((f) => f.path)).toEqual(["SKILL.md"]);
    expect(del.activePath).toBe("SKILL.md");
    expect(workspaceReducer(base, { type: "deleteFile", path: "SKILL.md" }).files).toHaveLength(2);
  });

  it("applyFix runs finding.fix.apply and replaces files", () => {
    const files: SkillFile[] = [{ path: "SKILL.md", content: "old" }];
    const finding = {
      ruleId: "E12",
      severity: "error",
      message: "m",
      why: "w",
      howToFix: "h",
      fix: { label: "Quote it", apply: (fs: SkillFile[]) => fs.map((f) => ({ ...f, content: "fixed" })) },
    } as Finding;
    const next = workspaceReducer({ files, activePath: "SKILL.md" }, { type: "applyFix", finding });
    expect(next.files[0].content).toBe("fixed");
  });

  it("applyFix is a no-op when the finding has no fix", () => {
    const finding = { ruleId: "W07", severity: "warning", message: "m", why: "w", howToFix: "h" } as Finding;
    const next = workspaceReducer(base, { type: "applyFix", finding });
    expect(next).toBe(base);
  });

  it("reset returns the demo starter", () => {
    const next = workspaceReducer(base, { type: "reset" });
    expect(next.files.some((f) => f.path === "SKILL.md")).toBe(true);
    expect(next.dirName).toBe("my-first-skill");
  });
});
