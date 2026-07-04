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
            ? "border-indigo-400 bg-indigo-500/20 text-indigo-200"
            : state === "done"
              ? "border-emerald-500 bg-emerald-500/20 text-emerald-300"
              : "border-neutral-700 text-neutral-500";
        return (
          <li key={label} className="flex items-center gap-2">
            <span className={`flex h-6 w-6 items-center justify-center rounded-full border ${badge}`}>{n}</span>
            <span className={state === "todo" ? "text-neutral-600" : "text-neutral-200"}>{label}</span>
            {n < STEPS.length && <span className="mx-1 hidden h-px w-6 bg-neutral-700 sm:inline-block" />}
          </li>
        );
      })}
    </ol>
  );
}
