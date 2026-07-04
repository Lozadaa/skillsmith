"use client";

import { useReducer, type Dispatch } from "react";
import { initialWizardState, seedSections, type WizardState } from "@/lib/wizard/state";

type TextField =
  | "name"
  | "descWhat"
  | "descWhen"
  | "descTriggers"
  | "descNegative"
  | "category"
  | "license"
  | "version";

export type WizardAction =
  | { type: "next" }
  | { type: "back" }
  | { type: "goto"; step: number }
  | { type: "setIntent"; field: keyof WizardState["intent"]; value: string }
  | { type: "selectArchetype"; archetypeId: string }
  | { type: "setText"; field: TextField; value: string }
  | { type: "toggle"; field: "disableModelInvocation"; value: boolean }
  | { type: "setSection"; id: string; value: string };

const clampStep = (n: number): number => Math.min(5, Math.max(1, n));

export function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case "next":
      return { ...state, step: clampStep(state.step + 1) };
    case "back":
      return { ...state, step: clampStep(state.step - 1) };
    case "goto":
      return { ...state, step: clampStep(action.step) };
    case "setIntent":
      return { ...state, intent: { ...state.intent, [action.field]: action.value } };
    case "selectArchetype":
      return { ...state, archetypeId: action.archetypeId, sections: seedSections(action.archetypeId) };
    case "setText":
      return { ...state, [action.field]: action.value } as WizardState;
    case "toggle":
      return { ...state, disableModelInvocation: action.value };
    case "setSection":
      return { ...state, sections: { ...state.sections, [action.id]: action.value } };
    default:
      return state;
  }
}

export function useWizard(): [WizardState, Dispatch<WizardAction>] {
  return useReducer(wizardReducer, initialWizardState);
}
