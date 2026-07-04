import type { ScoreResult } from "@/lib/skill-lint";

const BAND: Record<ScoreResult["band"], { label: string; cls: string }> = {
  excellent: { label: "Excellent", cls: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" },
  good: { label: "Good", cls: "border-sky-500/40 bg-sky-500/10 text-sky-300" },
  "needs-work": { label: "Needs work", cls: "border-amber-500/40 bg-amber-500/10 text-amber-300" },
  poor: { label: "Poor", cls: "border-red-500/40 bg-red-500/10 text-red-300" },
};

export function ScoreBadge({ score }: { score: ScoreResult }) {
  const band = BAND[score.band];
  return (
    <div
      className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 ${band.cls}`}
      title={`Score ${score.value}/100 — ${band.label}`}
    >
      <span className="text-lg font-bold tabular-nums">{score.value}</span>
      <span className="text-xs font-medium uppercase tracking-wide">{band.label}</span>
    </div>
  );
}
