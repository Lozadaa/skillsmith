"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { lintSkill } from "@/lib/skill-lint";
import { assembleSkill } from "@/lib/wizard/assemble";
import type { WizardState } from "@/lib/wizard/state";
import { stashIncomingSkill } from "@/lib/handoff";
import { zipSkill, downloadBlob } from "@/lib/zip";

const SEVERITY_COLOR: Record<string, string> = {
  error: "text-red-400",
  warning: "text-amber-400",
  suggestion: "text-neutral-400",
};

export function StepReview({ state }: { state: WizardState }) {
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
      <div className="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-900 p-4">
        <div>
          <p className="text-sm text-neutral-400">Lint score</p>
          <p className="text-2xl font-semibold text-neutral-100">
            {score ? `${score.value}/100` : "—"}
            {score && <span className="ml-2 text-sm font-normal text-neutral-400">{score.band}</span>}
          </p>
        </div>
        <div className="text-right text-xs text-neutral-400">
          <p>{files.length} file(s)</p>
          <p>{dirName || "unnamed"}/</p>
        </div>
      </div>

      <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
        <p className="mb-2 text-sm font-medium text-neutral-300">Findings</p>
        {findings.length === 0 ? (
          <p className="text-sm text-emerald-400">No findings — the skill is clean.</p>
        ) : (
          <ul className="space-y-2 text-xs">
            {findings.map((f, i) => (
              <li key={`${f.ruleId}-${i}`} className="flex gap-2">
                <span className={`font-mono ${SEVERITY_COLOR[f.severity]}`}>{f.ruleId}</span>
                <span className="text-neutral-300">{f.message}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={openInWorkspace}
          className="rounded bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-400"
        >
          Open in Workspace
        </button>
        <button
          type="button"
          onClick={download}
          disabled={exportBlocked}
          data-testid="download-zip"
          className="rounded border border-neutral-700 px-4 py-2 text-sm font-medium text-neutral-100 hover:border-neutral-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Download .zip
        </button>
        {errors.length > 0 && (
          <p className="w-full text-xs text-red-400">
            Fix the {errors.length} error finding(s) to enable download. You can still open the draft in the
            workspace to iterate.
          </p>
        )}
      </div>
    </div>
  );
}
