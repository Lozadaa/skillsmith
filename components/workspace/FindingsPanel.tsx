"use client";

import type { Finding, Severity } from "@/lib/skill-lint";
import { useLocale } from "@/components/LocaleProvider";

const SEVERITY_KEY: Record<Severity, string> = {
  error: "findingsPanel.severity.error",
  warning: "findingsPanel.severity.warning",
  suggestion: "findingsPanel.severity.suggestion",
};

const SEVERITY_META: Record<Severity, { dot: string; badge: string }> = {
  error: { dot: "bg-severity-error", badge: "border-severity-error text-severity-error" },
  warning: { dot: "bg-severity-warning", badge: "border-severity-warning text-severity-warning" },
  suggestion: {
    dot: "bg-severity-suggestion",
    badge: "border-severity-suggestion text-severity-suggestion",
  },
};

const ORDER: Severity[] = ["error", "warning", "suggestion"];

export function FindingsPanel({
  findings,
  onApplyFix,
}: {
  findings: Finding[];
  onApplyFix: (finding: Finding) => void;
}) {
  const { t } = useLocale();
  if (findings.length === 0) {
    return (
      <div className="p-6 text-sm text-ink-soft">
        {t("findingsPanel.none")}
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
            <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">
              <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
              {t(SEVERITY_KEY[sev])}
              <span className={`rounded-full border px-1.5 py-0.5 text-[10px] ${meta.badge}`}>{group.length}</span>
            </h3>
            <ul className="flex flex-col gap-2">
              {group.map((f, i) => (
                <li
                  key={`${f.ruleId}-${i}`}
                  className="ink-panel p-3"
                >
                  <div className="flex items-center gap-2">
                    <span className="rounded border border-ink px-1.5 py-0.5 font-mono text-[11px] text-ink">
                      {f.ruleId}
                    </span>
                    {typeof f.line === "number" && (
                      <span className="font-mono text-[11px] text-ink-soft">L{f.line}</span>
                    )}
                    {f.file && f.file !== "SKILL.md" && (
                      <span className="font-mono text-[11px] text-ink-soft">{f.file}</span>
                    )}
                    {f.fix && (
                      <button
                        type="button"
                        onClick={() => onApplyFix(f)}
                        className="ink-btn ml-auto px-2 py-1 text-xs font-medium"
                      >
                        {f.fix.label || t("findingsPanel.applyFix")}
                      </button>
                    )}
                  </div>
                  <p className="mt-2 text-sm text-ink">{f.message}</p>
                  <details className="mt-1 text-sm text-ink-soft">
                    <summary className="cursor-pointer select-none text-xs text-ink-soft hover:text-ink">
                      {t("findingsPanel.whyHow")}
                    </summary>
                    <p className="mt-2">
                      <span className="font-medium text-ink">{t("findingsPanel.why")}</span>
                      {f.why}
                    </p>
                    <p className="mt-1">
                      <span className="font-medium text-ink">{t("findingsPanel.fix")}</span>
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
