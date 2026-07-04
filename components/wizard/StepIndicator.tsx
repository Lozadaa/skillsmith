"use client";

const STEPS = ["Intent", "Archetype", "Description", "Content", "Review"];

export function StepIndicator({ step }: { step: number }) {
  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-2 text-xs">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const state = n === step ? "current" : n < step ? "done" : "todo";
        const badge =
          state === "current"
            ? "border-ember bg-ember text-paper"
            : state === "done"
              ? "border-ink bg-ink text-paper"
              : "border-ink-soft text-ink-soft";
        return (
          <li key={label} className="flex items-center gap-2">
            <span className={`flex h-6 w-6 items-center justify-center rounded-full border-2 font-display ${badge}`}>{n}</span>
            <span className={state === "todo" ? "text-ink-soft" : "text-ink"}>{label}</span>
            {n < STEPS.length && <span className="mx-1 hidden h-0.5 w-6 bg-ink sm:inline-block" />}
          </li>
        );
      })}
    </ol>
  );
}
