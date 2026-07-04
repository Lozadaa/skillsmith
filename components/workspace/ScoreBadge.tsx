"use client";

import type { ScoreResult } from "@/lib/skill-lint";
import { useLocale } from "@/components/LocaleProvider";

// Band drives the stamp's ink color via currentColor (used by .ink-stamp rings).
const BAND: Record<ScoreResult["band"], { key: string; ink: string }> = {
  // An excellent score earns the hot proof-mark — the one ember stamp on the page.
  excellent: { key: "scoreBadge.band.excellent", ink: "text-ember" },
  good: { key: "scoreBadge.band.good", ink: "text-ink" },
  "needs-work": { key: "scoreBadge.band.needsWork", ink: "text-severity-warning" },
  poor: { key: "scoreBadge.band.poor", ink: "text-severity-error" },
};

export function ScoreBadge({ score }: { score: ScoreResult }) {
  const { t } = useLocale();
  const band = BAND[score.band];
  const label = t(band.key);
  return (
    <div
      className={`ink-stamp flex h-20 w-20 shrink-0 -rotate-6 flex-col items-center justify-center ${band.ink}`}
      title={t("scoreBadge.title", { value: score.value, band: label })}
    >
      <span className="font-display text-3xl leading-none tabular-nums">{score.value}</span>
      <span className="mt-1 text-[10px] font-bold uppercase tracking-[0.14em]">{label}</span>
    </div>
  );
}
