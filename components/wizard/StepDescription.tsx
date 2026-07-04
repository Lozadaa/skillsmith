"use client";

import type { Dispatch } from "react";
import { estimateTokens } from "@/lib/skill-lint";
import { buildDescription, type WizardState } from "@/lib/wizard/state";
import type { WizardAction } from "./useWizard";
import { NameField } from "./NameField";

const fieldClass =
  "mt-1 w-full rounded border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-indigo-400";

// Kept local (UI must not import from lib/skill-lint/rules internals), but must byte-match
// the pattern the engine uses in lib/skill-lint/rules/warnings-description.ts (W04).
const PERSON_RE = /\b(I can|I will|I'll|you can|you should|you need|use this skill when you)\b/i;

export function StepDescription({ state, dispatch }: { state: WizardState; dispatch: Dispatch<WizardAction> }) {
  const set = (field: "descWhat" | "descWhen" | "descTriggers" | "descNegative", value: string) =>
    dispatch({ type: "setText", field, value });

  const description = buildDescription(state);
  const len = description.length;
  const overHard = len > 1024;
  const overWarn = len > 500;
  const hasPerson = PERSON_RE.test(description);

  const counterClass = overHard ? "text-red-400" : overWarn ? "text-amber-400" : "text-neutral-400";

  return (
    <div className="space-y-6">
      <NameField value={state.name} onChange={(v) => dispatch({ type: "setText", field: "name", value: v })} />

      <label className="block">
        <span className="text-sm font-medium text-neutral-200">What it does</span>
        <input
          className={fieldClass}
          placeholder="Generates release notes from a changelog"
          value={state.descWhat}
          onChange={(e) => set("descWhat", e.target.value)}
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-neutral-200">When to use it</span>
        <input
          className={fieldClass}
          placeholder="a changelog or merged-PR list needs a readable release note"
          value={state.descWhen}
          onChange={(e) => set("descWhen", e.target.value)}
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-neutral-200">Concrete trigger phrases (quoted)</span>
        <input
          className={fieldClass}
          placeholder={'"write release notes", "summarize the changelog"'}
          value={state.descTriggers}
          onChange={(e) => set("descTriggers", e.target.value)}
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-neutral-200">Negative triggers (optional)</span>
        <input
          className={fieldClass}
          placeholder="writing marketing copy or blog posts"
          value={state.descNegative}
          onChange={(e) => set("descNegative", e.target.value)}
        />
      </label>

      <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-neutral-300">Assembled description</span>
          <span className="flex gap-3">
            <span data-testid="desc-char-counter" className={counterClass}>
              {len}/1024 chars
            </span>
            <span className="text-neutral-500">~{estimateTokens(description)} tokens</span>
          </span>
        </div>
        <p data-testid="desc-preview" className="mt-2 text-sm text-neutral-200">
          {description}
        </p>
        {overWarn && !overHard && (
          <p data-testid="desc-warn" className="mt-2 text-xs text-amber-400">
            Long descriptions dilute triggering — aim for under 500 characters.
          </p>
        )}
        {overHard && (
          <p data-testid="desc-error" className="mt-2 text-xs text-red-400">
            Over the 1024-character hard limit — the skill will be rejected. Trim it.
          </p>
        )}
        {hasPerson && (
          <p data-testid="desc-person-hint" className="mt-2 text-xs text-amber-400">
            Prefer third-person, imperative phrasing over &ldquo;I can&rdquo; / &ldquo;you can&rdquo;.
          </p>
        )}
      </div>

      <div className="rounded-lg border border-neutral-800 bg-neutral-950 p-4">
        <p className="text-xs font-medium text-neutral-400">How the agent sees it</p>
        <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded bg-black/40 p-3 text-xs text-neutral-300">
{`name: ${state.name || "your-skill-name"}
description: ${description}`}
        </pre>
      </div>
    </div>
  );
}
