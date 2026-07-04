import { describe, it, expect } from "vitest";
import { assembleSkill, assembleBody } from "./assemble";
import { archetypes } from "./archetypes";
import { buildDescription, initialWizardState, seedSections, type WizardState } from "./state";
import { lintSkill } from "@/lib/skill-lint";

function minimalState(archetypeId: string): WizardState {
  return {
    ...initialWizardState,
    step: 5,
    archetypeId,
    name: "demo-skill",
    descWhat: "Produces a demo artifact",
    descWhen: "the user asks for a demo",
    descTriggers: '"make a demo", "demo this"',
    category: "Utility & Automation",
    license: "MIT",
    version: "1.0.0",
    sections: seedSections(archetypeId),
  };
}

describe("buildDescription", () => {
  it("concatenates the three fields and appends the negative clause", () => {
    const s = { ...minimalState("technique"), descNegative: "unrelated tasks" };
    expect(buildDescription(s)).toBe(
      'Produces a demo artifact. Use when the user asks for a demo. Triggers: "make a demo", "demo this". Do not use for unrelated tasks.'
    );
  });
  it("omits the negative clause when empty", () => {
    expect(buildDescription(minimalState("technique"))).toBe(
      'Produces a demo artifact. Use when the user asks for a demo. Triggers: "make a demo", "demo this".'
    );
  });
});

describe("assembleSkill frontmatter", () => {
  it("emits SKILL.md as the first file with dirName equal to name", () => {
    const { files, dirName } = assembleSkill(minimalState("technique"));
    expect(files[0].path).toBe("SKILL.md");
    expect(dirName).toBe("demo-skill");
  });

  it("omits optional fields when unset", () => {
    const s = { ...minimalState("technique"), license: "none", category: "", version: "" };
    const md = assembleSkill(s).files[0].content;
    expect(md).not.toContain("license:");
    expect(md).not.toContain("metadata:");
    expect(md).not.toContain("disable-model-invocation");
  });

  it("includes license, metadata and the disable flag when set", () => {
    const s = { ...minimalState("technique"), disableModelInvocation: true };
    const r = lintSkill(assembleSkill(s).files, { dirName: s.name });
    if (r.kind !== "skill") throw new Error(r.reason);
    const fm = r.skill.frontmatter.data;
    expect(fm["name"]).toBe("demo-skill");
    expect(fm["license"]).toBe("MIT");
    expect(fm["disable-model-invocation"]).toBe(true);
    expect((fm["metadata"] as Record<string, unknown>).version).toBe("1.0.0");
    expect((fm["metadata"] as Record<string, unknown>).category).toBe("Utility & Automation");
  });

  it("includes the archetype's extra files", () => {
    const { files } = assembleSkill(minimalState("reference"));
    const paths = files.map((f) => f.path);
    expect(paths).toContain("references/concepts.md");
    expect(paths).toContain("references/api.md");
  });

  it("assembleBody starts with an H1 title derived from the name", () => {
    expect(assembleBody(minimalState("technique"))).toMatch(/^# Demo Skill\n/);
  });
});

describe("QUALITY GATE: every archetype assembles and lints with zero errors", () => {
  it.each(archetypes.map((a) => a.id))("archetype %s has no error-severity findings", (id) => {
    const { files, dirName } = assembleSkill(minimalState(id));
    const r = lintSkill(files, { dirName });
    if (r.kind !== "skill") throw new Error(`${id}: not-a-skill (${r.reason})`);
    const errors = r.findings.filter((f) => f.severity === "error");
    expect(
      errors,
      `${id} produced errors: ${errors.map((e) => `${e.ruleId} ${e.message}`).join(" | ")}`
    ).toEqual([]);
  });
});
