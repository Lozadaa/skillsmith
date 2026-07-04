"use client";

import type { Dispatch } from "react";
import { estimateTokens } from "@/lib/skill-lint";
import { buildDescription, type WizardState } from "@/lib/wizard/state";
import type { WizardAction } from "./useWizard";
import { NameField } from "./NameField";

const fieldClass =
  "mt-1 w-full rounded border-2 border-ink bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-ember";

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

  const counterClass = overHard ? "text-severity-error" : overWarn ? "text-severity-warning" : "text-ink-soft";

  return (
    <div className="space-y-6">
      <NameField value={state.name} onChange={(v) => dispatch({ type: "setText", field: "name", value: v })} />

      <label className="block">
        <span className="text-sm font-medium text-ink">What it does</span>
        <input
          className={fieldClass}
          placeholder="Generates release notes from a changelog"
          value={state.descWhat}
          onChange={(e) => set("descWhat", e.target.value)}
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-ink">When to use it</span>
        <input
          className={fieldClass}
          placeholder="a changelog or merged-PR list needs a readable release note"
          value={state.descWhen}
          onChange={(e) => set("descWhen", e.target.value)}
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-ink">Concrete trigger phrases (quoted)</span>
        <input
          className={fieldClass}
          placeholder={'"write release notes", "summarize the changelog"'}
          value={state.descTriggers}
          onChange={(e) => set("descTriggers", e.target.value)}
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-ink">Negative triggers (optional)</span>
        <input
          className={fieldClass}
          placeholder="writing marketing copy or blog posts"
          value={state.descNegative}
          onChange={(e) => set("descNegative", e.target.value)}
        />
      </label>

      <div className="ink-panel p-4">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-ink">Assembled description</span>
          <span className="flex gap-3">
            <span data-testid="desc-char-counter" className={counterClass}>
              {len}/1024 chars
            </span>
            <span className="text-ink-soft">~{estimateTokens(description)} tokens</span>
          </span>
        </div>
        <p data-testid="desc-preview" className="mt-2 text-sm text-ink">
          {description}
        </p>
        {overWarn && !overHard && (
          <p data-testid="desc-warn" className="mt-2 text-xs text-severity-warning">
            Long descriptions dilute triggering — aim for under 500 characters.
          </p>
        )}
        {overHard && (
          <p data-testid="desc-error" className="mt-2 text-xs text-severity-error">
            Over the 1024-character hard limit — the skill will be rejected. Trim it.
          </p>
        )}
        {hasPerson && (
          <p data-testid="desc-person-hint" className="mt-2 text-xs text-severity-warning">
            Prefer third-person, imperative phrasing over &ldquo;I can&rdquo; / &ldquo;you can&rdquo;.
          </p>
        )}
      </div>

      <div className="ink-panel p-4">
        <p className="text-xs font-medium text-ink-soft">How the agent sees it</p>
        <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded bg-ink/5 p-3 font-mono text-xs text-ink">
{`name: ${state.name || "your-skill-name"}
description: ${description}`}
        </pre>
      </div>
    </div>
  );
}
