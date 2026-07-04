"use client";

import type { Dispatch } from "react";
import { estimateTokens } from "@/lib/skill-lint";
import { getArchetype } from "@/lib/wizard/archetypes";
import { assembleBody, type WizardState } from "@/lib/wizard/assemble";
import type { WizardAction } from "./useWizard";

const CATEGORIES = [
  "Development & Code Tools",
  "Data & Analysis",
  "Document Processing",
  "Creative & Design",
  "Writing & Research",
  "Learning & Knowledge",
  "Media & Content",
  "Collaboration & PM",
  "Marketing & SEO",
  "Career",
  "Security & Testing",
  "Utility & Automation",
  "Meta/Context Engineering",
];
const LICENSES = ["none", "MIT", "Apache-2.0", "Proprietary"];

const fieldClass =
  "mt-1 w-full rounded border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-indigo-400";

export function StepContent({ state, dispatch }: { state: WizardState; dispatch: Dispatch<WizardAction> }) {
  const archetype = getArchetype(state.archetypeId);
  const body = assembleBody(state);
  const lines = body.split("\n").length;
  const words = body.split(/\s+/).filter(Boolean).length;
  const tokens = estimateTokens(body);

  return (
    <div className="space-y-6">
      {archetype?.sections.map((s) => (
        <label key={s.id} className="block">
          <span className="text-sm font-medium text-neutral-200">{s.title}</span>
          <textarea
            rows={5}
            className={`${fieldClass} font-mono`}
            placeholder={s.placeholder}
            value={state.sections[s.id] ?? ""}
            onChange={(e) => dispatch({ type: "setSection", id: s.id, value: e.target.value })}
          />
        </label>
      ))}

      <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4 text-xs">
        <div className="flex flex-wrap gap-4 text-neutral-400">
          <span data-testid="body-lines">{lines} lines</span>
          <span>{words} words</span>
          <span>~{tokens} tokens</span>
        </div>
        {lines > 400 && (
          <p data-testid="body-warn" className="mt-2 text-amber-400">
            The body is over 400 lines — move detail into references/ so it loads only when needed.
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium text-neutral-200">Category</span>
          <select
            className={fieldClass}
            value={state.category}
            onChange={(e) => dispatch({ type: "setText", field: "category", value: e.target.value })}
          >
            <option value="">None</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-medium text-neutral-200">License</span>
          <select
            className={fieldClass}
            value={state.license}
            onChange={(e) => dispatch({ type: "setText", field: "license", value: e.target.value })}
          >
            {LICENSES.map((l) => (
              <option key={l} value={l}>
                {l === "none" ? "None" : l}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-medium text-neutral-200">Version</span>
          <input
            className={fieldClass}
            value={state.version}
            onChange={(e) => dispatch({ type: "setText", field: "version", value: e.target.value })}
          />
        </label>

        <label className="flex items-center gap-2 self-end pb-2">
          <input
            type="checkbox"
            checked={state.disableModelInvocation}
            onChange={(e) => dispatch({ type: "toggle", field: "disableModelInvocation", value: e.target.checked })}
          />
          <span className="text-sm text-neutral-200">User-invoked only (disable-model-invocation)</span>
        </label>
      </div>
    </div>
  );
}
