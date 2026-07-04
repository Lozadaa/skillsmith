import { describe, it, expect } from "vitest";
import { wizardReducer } from "./useWizard";
import { initialWizardState } from "@/lib/wizard/state";
import { getArchetype } from "@/lib/wizard/archetypes";

describe("wizardReducer", () => {
  it("starts at step 1", () => {
    expect(initialWizardState.step).toBe(1);
  });

  it("advances and clamps at step 5", () => {
    let s = initialWizardState;
    for (let i = 0; i < 10; i++) s = wizardReducer(s, { type: "next" });
    expect(s.step).toBe(5);
  });

  it("goes back and clamps at step 1", () => {
    let s = { ...initialWizardState, step: 2 };
    s = wizardReducer(s, { type: "back" });
    s = wizardReducer(s, { type: "back" });
    expect(s.step).toBe(1);
  });

  it("goto clamps into 1..5", () => {
    expect(wizardReducer(initialWizardState, { type: "goto", step: 9 }).step).toBe(5);
    expect(wizardReducer(initialWizardState, { type: "goto", step: 0 }).step).toBe(1);
    expect(wizardReducer(initialWizardState, { type: "goto", step: 3 }).step).toBe(3);
  });

  it("updates nested intent fields immutably", () => {
    const s = wizardReducer(initialWizardState, { type: "setIntent", field: "what", value: "lint skills" });
    expect(s.intent.what).toBe("lint skills");
    expect(s.intent.when).toBe("");
    expect(initialWizardState.intent.what).toBe("");
  });

  it("selectArchetype records the id and seeds every section", () => {
    const s = wizardReducer(initialWizardState, { type: "selectArchetype", archetypeId: "reference" });
    expect(s.archetypeId).toBe("reference");
    const a = getArchetype("reference")!;
    for (const sec of a.sections) {
      expect(s.sections[sec.id]).toBe(sec.defaultContent);
    }
  });

  it("re-seeds sections when the archetype changes", () => {
    let s = wizardReducer(initialWizardState, { type: "selectArchetype", archetypeId: "reference" });
    s = wizardReducer(s, { type: "setSection", id: "overview", value: "edited" });
    s = wizardReducer(s, { type: "selectArchetype", archetypeId: "technique" });
    expect(s.archetypeId).toBe("technique");
    expect(s.sections["overview"]).toBe(getArchetype("technique")!.sections[0].defaultContent);
  });

  it("setText updates a flat string field", () => {
    const s = wizardReducer(initialWizardState, { type: "setText", field: "name", value: "my-skill" });
    expect(s.name).toBe("my-skill");
  });

  it("toggle updates the boolean flag", () => {
    const s = wizardReducer(initialWizardState, { type: "toggle", field: "disableModelInvocation", value: true });
    expect(s.disableModelInvocation).toBe(true);
  });

  it("setSection updates one section without touching others", () => {
    let s = wizardReducer(initialWizardState, { type: "selectArchetype", archetypeId: "technique" });
    s = wizardReducer(s, { type: "setSection", id: "steps", value: "new steps" });
    expect(s.sections["steps"]).toBe("new steps");
    expect(s.sections["overview"]).toBe(getArchetype("technique")!.sections[0].defaultContent);
  });
});
