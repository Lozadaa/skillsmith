import type { ScoreResult } from "@/lib/skill-lint";

// Band drives the stamp's ink color via currentColor (used by .ink-stamp rings).
const BAND: Record<ScoreResult["band"], { label: string; ink: string }> = {
  // An excellent score earns the hot proof-mark — the one ember stamp on the page.
  excellent: { label: "Excellent", ink: "text-ember" },
  good: { label: "Good", ink: "text-ink" },
  "needs-work": { label: "Needs work", ink: "text-severity-warning" },
  poor: { label: "Poor", ink: "text-severity-error" },
};

export function ScoreBadge({ score }: { score: ScoreResult }) {
  const band = BAND[score.band];
  return (
    <div
      className={`ink-stamp flex h-20 w-20 shrink-0 -rotate-6 flex-col items-center justify-center ${band.ink}`}
      title={`Score ${score.value}/100 — ${band.label}`}
    >
      <span className="font-display text-3xl leading-none tabular-nums">{score.value}</span>
      <span className="mt-1 text-[10px] font-bold uppercase tracking-[0.14em]">{band.label}</span>
    </div>
  );
}
