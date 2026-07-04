"use client";

import type { Dispatch } from "react";
import type { WizardState } from "@/lib/wizard/state";
import type { WizardAction } from "./useWizard";

const fieldClass =
  "mt-1 w-full rounded border-2 border-ink bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-ember";

export function StepIntent({ state, dispatch }: { state: WizardState; dispatch: Dispatch<WizardAction> }) {
  const set = (field: keyof WizardState["intent"], value: string) =>
    dispatch({ type: "setIntent", field, value });

  return (
    <div className="space-y-6">
      <div className="ink-panel p-4 text-sm text-ink">
        <p className="font-medium">One skill = one capability.</p>
        <p className="mt-1 text-ink-soft">
          Good: &ldquo;Generate release notes from a changelog.&rdquo; &nbsp;·&nbsp; Bad: &ldquo;Help with
          engineering&rdquo; (too broad — split it into focused skills).
        </p>
      </div>

      <label className="block">
        <span className="text-sm font-medium text-ink">What does this skill enable?</span>
        <textarea
          rows={2}
          className={fieldClass}
          placeholder="Generate spec-compliant release notes from a changelog."
          value={state.intent.what}
          onChange={(e) => set("what", e.target.value)}
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-ink">When should it trigger?</span>
        <textarea
          rows={2}
          className={fieldClass}
          placeholder="A changelog or list of merged PRs needs to become a readable release note."
          value={state.intent.when}
          onChange={(e) => set("when", e.target.value)}
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-ink">Expected output format</span>
        <input
          className={fieldClass}
          placeholder="Markdown document with Highlights / Fixes / Breaking sections."
          value={state.intent.output}
          onChange={(e) => set("output", e.target.value)}
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-ink">Personal or shared?</span>
        <select
          className={fieldClass}
          value={state.intent.distribution}
          onChange={(e) => set("distribution", e.target.value)}
        >
          <option value="personal">Personal — just for my own use</option>
          <option value="shared">Shared — distribute to a team or the community</option>
        </select>
      </label>
    </div>
  );
}
