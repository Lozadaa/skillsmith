"use client";

import type { Finding, Severity } from "@/lib/skill-lint";

const SEVERITY_META: Record<Severity, { label: string; dot: string; badge: string }> = {
  error: { label: "Errors", dot: "bg-red-500", badge: "border-red-500/30 bg-red-500/15 text-red-300" },
  warning: { label: "Warnings", dot: "bg-amber-500", badge: "border-amber-500/30 bg-amber-500/15 text-amber-300" },
  suggestion: { label: "Suggestions", dot: "bg-sky-500", badge: "border-sky-500/30 bg-sky-500/15 text-sky-300" },
};

const ORDER: Severity[] = ["error", "warning", "suggestion"];

export function FindingsPanel({
  findings,
  onApplyFix,
}: {
  findings: Finding[];
  onApplyFix: (finding: Finding) => void;
}) {
  if (findings.length === 0) {
    return (
      <div className="p-6 text-sm text-neutral-400">
        No findings. This skill passes every enabled rule.
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-5 p-3">
      {ORDER.map((sev) => {
        const group = findings.filter((f) => f.severity === sev);
        if (group.length === 0) return null;
        const meta = SEVERITY_META[sev];
        return (
          <section key={sev}>
            <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
              <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
              {meta.label}
              <span className={`rounded-full border px-1.5 py-0.5 text-[10px] ${meta.badge}`}>{group.length}</span>
            </h3>
            <ul className="flex flex-col gap-2">
              {group.map((f, i) => (
                <li
                  key={`${f.ruleId}-${i}`}
                  className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-3"
                >
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-neutral-800 px-1.5 py-0.5 font-mono text-[11px] text-neutral-300">
                      {f.ruleId}
                    </span>
                    {typeof f.line === "number" && (
                      <span className="font-mono text-[11px] text-neutral-500">L{f.line}</span>
                    )}
                    {f.file && f.file !== "SKILL.md" && (
                      <span className="font-mono text-[11px] text-neutral-500">{f.file}</span>
                    )}
                    {f.fix && (
                      <button
                        type="button"
                        onClick={() => onApplyFix(f)}
                        className="ml-auto rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-300 hover:bg-emerald-500/20"
                      >
                        {f.fix.label || "Apply fix"}
                      </button>
                    )}
                  </div>
                  <p className="mt-2 text-sm text-neutral-100">{f.message}</p>
                  <details className="mt-1 text-sm text-neutral-400">
                    <summary className="cursor-pointer select-none text-xs text-neutral-500 hover:text-neutral-300">
                      Why it matters &amp; how to fix
                    </summary>
                    <p className="mt-2">
                      <span className="font-medium text-neutral-300">Why: </span>
                      {f.why}
                    </p>
                    <p className="mt-1">
                      <span className="font-medium text-neutral-300">Fix: </span>
                      {f.howToFix}
                    </p>
                  </details>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
