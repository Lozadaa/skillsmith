"use client";

import type { Dispatch } from "react";
import { archetypes } from "@/lib/wizard/archetypes";
import type { WizardState } from "@/lib/wizard/state";
import type { WizardAction } from "./useWizard";

export function StepArchetype({ state, dispatch }: { state: WizardState; dispatch: Dispatch<WizardAction> }) {
  return (
    <div>
      <p className="mb-4 text-sm text-neutral-400">
        Pick the shape that matches the capability. It seeds the section scaffold on the next steps.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {archetypes.map((a) => {
          const selected = state.archetypeId === a.id;
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => dispatch({ type: "selectArchetype", archetypeId: a.id })}
              className={
                "rounded-lg border p-4 text-left transition " +
                (selected
                  ? "border-indigo-400 bg-indigo-500/10"
                  : "border-neutral-800 bg-neutral-900 hover:border-neutral-600")
              }
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-neutral-100">{a.title}</h3>
                {a.advanced && (
                  <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-medium text-amber-300">
                    Advanced
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-neutral-400">{a.blurb}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
