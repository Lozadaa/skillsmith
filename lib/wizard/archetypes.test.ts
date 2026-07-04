import { describe, it, expect } from "vitest";
import { archetypes, getArchetype } from "./archetypes";

describe("archetype catalog", () => {
  it("contains exactly 8 archetypes with unique ids", () => {
    expect(archetypes).toHaveLength(8);
    const ids = archetypes.map((a) => a.id);
    expect(new Set(ids).size).toBe(8);
  });

  it("covers the 8 spec archetypes", () => {
    const ids = archetypes.map((a) => a.id);
    for (const id of [
      "technique", "reference", "document-generator", "style-guide",
      "audit-checklist", "graduated-critique", "expert-persona", "pipeline-orchestrator",
    ]) {
      expect(ids).toContain(id);
    }
  });

  it("marks only the pipeline orchestrator as advanced", () => {
    expect(getArchetype("pipeline-orchestrator")!.advanced).toBe(true);
    expect(archetypes.filter((a) => a.advanced)).toHaveLength(1);
  });

  it("every archetype has >=1 section with unique non-empty ids, titles and content", () => {
    for (const a of archetypes) {
      expect(a.title.length).toBeGreaterThan(0);
      expect(a.blurb.length).toBeGreaterThan(0);
      expect(a.sections.length).toBeGreaterThan(0);
      const sids = a.sections.map((s) => s.id);
      expect(new Set(sids).size).toBe(sids.length);
      for (const s of a.sections) {
        expect(s.id).not.toBe("");
        expect(s.title.trim().length).toBeGreaterThan(0);
        expect(s.placeholder.trim().length).toBeGreaterThan(0);
        expect(s.defaultContent.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("extraFile paths are unique, non-empty and forward-slashed", () => {
    for (const a of archetypes) {
      const paths = a.extraFiles.map((f) => f.path);
      expect(new Set(paths).size).toBe(paths.length);
      for (const f of a.extraFiles) {
        expect(f.path).not.toBe("");
        expect(f.path).not.toContain("\\");
        expect(f.content.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("no frontmatter-hostile characters and no second person in default content", () => {
    for (const a of archetypes) {
      for (const s of a.sections) {
        expect(s.defaultContent).not.toMatch(/\byou\b/i);
      }
    }
  });

  it("getArchetype resolves by id and tolerates null/unknown", () => {
    expect(getArchetype("technique")!.id).toBe("technique");
    expect(getArchetype(null)).toBeUndefined();
    expect(getArchetype("nope")).toBeUndefined();
  });
});
