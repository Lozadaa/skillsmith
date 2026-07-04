"use client";

import type { Dispatch } from "react";
import { archetypes } from "@/lib/wizard/archetypes";
import type { WizardState } from "@/lib/wizard/state";
import type { WizardAction } from "./useWizard";

export function StepArchetype({ state, dispatch }: { state: WizardState; dispatch: Dispatch<WizardAction> }) {
  return (
    <div>
      <p className="mb-4 text-sm text-ink-soft">
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
                "ink-panel ink-card p-4 text-left " +
                (selected ? "outline outline-2 outline-ember" : "")
              }
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-display text-lg text-ink">{a.title}</h3>
                {a.advanced && (
                  <span className="rounded border border-severity-warning px-1.5 py-0.5 text-[10px] font-medium text-severity-warning">
                    Advanced
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-ink-soft">{a.blurb}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
