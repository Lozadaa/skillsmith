import { getArchetype } from "./archetypes";
import { validateName } from "./name";

export interface WizardIntent {
  what: string;
  when: string;
  distribution: string;
}

export interface WizardState {
  step: number;
  intent: WizardIntent;
  archetypeId: string | null;
  name: string;
  descWhat: string;
  descWhen: string;
  descTriggers: string;
  descNegative: string;
  category: string;
  license: string;
  version: string;
  disableModelInvocation: boolean;
  sections: Record<string, string>;
}

export const initialWizardState: WizardState = {
  step: 1,
  intent: { what: "", when: "", distribution: "personal" },
  archetypeId: null,
  name: "",
  descWhat: "",
  descWhen: "",
  descTriggers: "",
  descNegative: "",
  category: "",
  license: "none",
  version: "1.0.0",
  disableModelInvocation: false,
  sections: {},
};

/** Seed the per-section editor state from an archetype's default content. */
export function seedSections(archetypeId: string | null): Record<string, string> {
  const a = getArchetype(archetypeId);
  const out: Record<string, string> = {};
  if (a) for (const s of a.sections) out[s.id] = s.defaultContent;
  return out;
}

/** Assemble the description exactly as previewed in Step 3. */
export function buildDescription(
  s: Pick<WizardState, "descWhat" | "descWhen" | "descTriggers" | "descNegative">
): string {
  const clean = (v: string) => v.trim().replace(/\.$/, "");
  const base = `${clean(s.descWhat)}. Use when ${clean(s.descWhen)}. Triggers: ${clean(s.descTriggers)}.`;
  return s.descNegative ? `${base} Do not use for ${clean(s.descNegative)}.` : base;
}

/** Whether the current step has the minimum input needed to move forward. */
export function canAdvance(s: WizardState): boolean {
  switch (s.step) {
    case 1:
      return s.intent.what.trim() !== "" && s.intent.when.trim() !== "";
    case 2:
      return s.archetypeId !== null;
    case 3:
      return (
        validateName(s.name).ok &&
        s.descWhat.trim() !== "" &&
        s.descWhen.trim() !== "" &&
        s.descTriggers.trim() !== ""
      );
    case 4:
      return true;
    default:
      return false;
  }
}
