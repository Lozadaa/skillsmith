"use client";

import type { Dispatch } from "react";
import type { WizardState } from "@/lib/wizard/state";
import type { WizardAction } from "./useWizard";
import { useLocale } from "@/components/LocaleProvider";

const fieldClass =
  "mt-1 w-full rounded border-2 border-ink bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-ember";

export function StepIntent({ state, dispatch }: { state: WizardState; dispatch: Dispatch<WizardAction> }) {
  const { t } = useLocale();
  const set = (field: keyof WizardState["intent"], value: string) =>
    dispatch({ type: "setIntent", field, value });

  return (
    <div className="space-y-6">
      <div className="ink-panel p-4 text-sm text-ink">
        <p className="font-medium">{t("wizard.intent.rule.title")}</p>
        <p className="mt-1 text-ink-soft">{t("wizard.intent.rule.body")}</p>
      </div>

      <label className="block">
        <span className="text-sm font-medium text-ink">{t("wizard.intent.what.label")}</span>
        <textarea
          rows={2}
          className={fieldClass}
          placeholder={t("wizard.intent.what.placeholder")}
          value={state.intent.what}
          onChange={(e) => set("what", e.target.value)}
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-ink">{t("wizard.intent.when.label")}</span>
        <textarea
          rows={2}
          className={fieldClass}
          placeholder={t("wizard.intent.when.placeholder")}
          value={state.intent.when}
          onChange={(e) => set("when", e.target.value)}
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-ink">{t("wizard.intent.distribution.label")}</span>
        <select
          className={fieldClass}
          value={state.intent.distribution}
          onChange={(e) => set("distribution", e.target.value)}
        >
          <option value="personal">{t("wizard.intent.distribution.personal")}</option>
          <option value="shared">{t("wizard.intent.distribution.shared")}</option>
        </select>
      </label>
    </div>
  );
}
