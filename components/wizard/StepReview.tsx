"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { lintSkill } from "@/lib/skill-lint";
import { assembleSkill } from "@/lib/wizard/assemble";
import type { WizardState } from "@/lib/wizard/state";
import { stashIncomingSkill } from "@/lib/handoff";
import { zipSkill, downloadBlob } from "@/lib/zip";
import { useLocale } from "@/components/LocaleProvider";

const SEVERITY_COLOR: Record<string, string> = {
  error: "text-severity-error",
  warning: "text-severity-warning",
  suggestion: "text-severity-suggestion",
};

export function StepReview({ state }: { state: WizardState }) {
  const { t } = useLocale();
  const router = useRouter();
  const { files, dirName } = useMemo(() => assembleSkill(state), [state]);
  const outcome = useMemo(() => lintSkill(files, { dirName }), [files, dirName]);

  const findings = outcome.kind === "skill" ? outcome.findings : [];
  const errors = findings.filter((f) => f.severity === "error");
  const score = outcome.kind === "skill" ? outcome.score : null;
  const exportBlocked = outcome.kind !== "skill" || errors.length > 0;

  function openInWorkspace() {
    stashIncomingSkill(files, { dirName, source: "wizard" });
    router.push("/workspace");
  }

  function download() {
    const bytes = zipSkill(files, dirName);
    downloadBlob(`${dirName}.zip`, bytes, "application/zip");
  }

  return (
    <div className="space-y-6">
      <div className="ink-panel flex items-center justify-between p-4">
        <div>
          <p className="text-sm text-ink-soft">{t("wizard.review.lintScore")}</p>
          <p className="font-display text-3xl text-ink">
            {score ? `${score.value}/100` : "-"}
            {score && <span className="ml-2 text-sm font-normal text-ink-soft">{score.band}</span>}
          </p>
        </div>
        <div className="text-right text-xs text-ink-soft">
          <p>{t("wizard.review.filesCount", { count: files.length })}</p>
          <p>{dirName || t("wizard.review.unnamed")}/</p>
        </div>
      </div>

      <div className="ink-panel p-4">
        <p className="mb-2 text-sm font-medium text-ink">{t("wizard.review.findings")}</p>
        {findings.length === 0 ? (
          <p className="text-sm text-ink-soft">{t("wizard.review.noFindings")}</p>
        ) : (
          <ul className="space-y-2 text-xs">
            {findings.map((f, i) => (
              <li key={`${f.ruleId}-${i}`} className="flex gap-2">
                <span className={`font-mono ${SEVERITY_COLOR[f.severity]}`}>{f.ruleId}</span>
                <span className="text-ink">{f.message}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={openInWorkspace}
          className="ink-btn px-4 py-2 text-sm font-medium"
        >
          {t("wizard.review.openWorkspace")}
        </button>
        <button
          type="button"
          onClick={download}
          disabled={exportBlocked}
          data-testid="download-zip"
          className="ink-btn px-4 py-2 text-sm font-medium"
        >
          {t("exportButtons.zip")}
        </button>
        {errors.length > 0 && (
          <p className="w-full text-xs text-severity-error">
            {t("wizard.review.fixErrors", { count: errors.length })}
          </p>
        )}
      </div>
    </div>
  );
}
