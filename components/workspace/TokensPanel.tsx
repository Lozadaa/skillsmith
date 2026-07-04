"use client";

import type { TokenReport } from "@/lib/skill-lint";
import { useLocale } from "@/components/LocaleProvider";

interface Row {
  key: string;
  label: string;
  value: number;
  unit: "tokens" | "files";
  note: string;
}

export function TokensPanel({ tokens }: { tokens: TokenReport }) {
  const { t } = useLocale();
  const rows: Row[] = [
    {
      key: "metadata",
      label: t("tokensPanel.metadata.label"),
      value: tokens.metadata,
      unit: "tokens",
      note: t("tokensPanel.metadata.note"),
    },
    {
      key: "body",
      label: t("tokensPanel.body.label"),
      value: tokens.body,
      unit: "tokens",
      note: t("tokensPanel.body.note"),
    },
    {
      key: "references",
      label: t("tokensPanel.references.label"),
      value: tokens.references,
      unit: "tokens",
      note: t("tokensPanel.references.note"),
    },
    {
      key: "scripts",
      label: t("tokensPanel.scripts.label"),
      value: tokens.scriptFiles,
      unit: "files",
      note: t("tokensPanel.scripts.note"),
    },
  ];
  const maxTokens = Math.max(1, tokens.metadata, tokens.body, tokens.references);

  return (
    <div className="flex flex-col gap-4 p-4">
      <p className="text-xs text-ink-soft">{t("tokensPanel.estimateNote")}</p>
      <ul className="flex flex-col gap-4">
        {rows.map((r) => {
          const pct = r.unit === "tokens" ? Math.round((r.value / maxTokens) * 100) : 0;
          return (
            <li key={r.key}>
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-ink">{r.label}</span>
                <span className="font-mono text-ink-soft">
                  {r.value}{" "}
                  {r.unit === "tokens"
                    ? t("tokensPanel.unit.tok")
                    : r.value === 1
                      ? t("tokensPanel.unit.file")
                      : t("tokensPanel.unit.files")}
                </span>
              </div>
              {r.unit === "tokens" && (
                <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-ink/10">
                  <div className="h-full rounded-full bg-ink" style={{ width: `${pct}%` }} />
                </div>
              )}
              <p className="mt-1 text-xs text-ink-soft">{r.note}</p>
            </li>
          );
        })}
      </ul>
      <div className="flex items-baseline justify-between border-t-2 border-ink pt-3 text-sm">
        <span className="font-medium text-ink">{t("tokensPanel.total")}</span>
        <span className="font-mono text-ink">
          {tokens.total} {t("tokensPanel.unit.tok")}
        </span>
      </div>
    </div>
  );
}
