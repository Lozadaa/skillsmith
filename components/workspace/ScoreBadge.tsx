import type { ScoreResult } from "@/lib/skill-lint";

// Band drives the stamp's ink color via currentColor (used by .ink-stamp rings).
const BAND: Record<ScoreResult["band"], { label: string; ink: string }> = {
  excellent: { label: "Excellent", ink: "text-ink" },
  good: { label: "Good", ink: "text-ink" },
  "needs-work": { label: "Needs work", ink: "text-severity-warning" },
  poor: { label: "Poor", ink: "text-severity-error" },
};

export function ScoreBadge({ score }: { score: ScoreResult }) {
  const band = BAND[score.band];
  return (
    <div
      className={`ink-stamp flex h-16 w-16 shrink-0 -rotate-6 flex-col items-center justify-center ${band.ink}`}
      title={`Score ${score.value}/100 — ${band.label}`}
    >
      <span className="font-display text-2xl leading-none tabular-nums">{score.value}</span>
      <span className="mt-0.5 text-[8px] font-semibold uppercase tracking-[0.15em]">{band.label}</span>
    </div>
  );
}
