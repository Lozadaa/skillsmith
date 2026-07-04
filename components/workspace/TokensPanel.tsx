"use client";

import type { TokenReport } from "@/lib/skill-lint";

interface Row {
  key: string;
  label: string;
  value: number;
  unit: "tokens" | "files";
  note: string;
}

export function TokensPanel({ tokens }: { tokens: TokenReport }) {
  const rows: Row[] = [
    {
      key: "metadata",
      label: "Metadata (name + description)",
      value: tokens.metadata,
      unit: "tokens",
      note: "Loaded into every conversation — the most expensive tokens you own.",
    },
    {
      key: "body",
      label: "SKILL.md body",
      value: tokens.body,
      unit: "tokens",
      note: "Loaded only when the skill triggers.",
    },
    {
      key: "references",
      label: "references/ files",
      value: tokens.references,
      unit: "tokens",
      note: "Zero cost until the agent opens them — moving content here is free.",
    },
    {
      key: "scripts",
      label: "scripts/ files",
      value: tokens.scriptFiles,
      unit: "files",
      note: "Executed, never loaded — only their output consumes context.",
    },
  ];
  const maxTokens = Math.max(1, tokens.metadata, tokens.body, tokens.references);

  return (
    <div className="flex flex-col gap-4 p-4">
      <p className="text-xs text-neutral-500">
        ~estimated — Anthropic does not publish the Claude 3+ tokenizer, so these are heuristic counts.
      </p>
      <ul className="flex flex-col gap-4">
        {rows.map((r) => {
          const pct = r.unit === "tokens" ? Math.round((r.value / maxTokens) * 100) : 0;
          return (
            <li key={r.key}>
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-neutral-200">{r.label}</span>
                <span className="font-mono text-neutral-400">
                  {r.value} {r.unit === "tokens" ? "tok" : r.value === 1 ? "file" : "files"}
                </span>
              </div>
              {r.unit === "tokens" && (
                <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-neutral-800">
                  <div className="h-full rounded-full bg-sky-500" style={{ width: `${pct}%` }} />
                </div>
              )}
              <p className="mt-1 text-xs text-neutral-500">{r.note}</p>
            </li>
          );
        })}
      </ul>
      <div className="flex items-baseline justify-between border-t border-neutral-800 pt-3 text-sm">
        <span className="font-medium text-neutral-100">Total context (metadata + body + references)</span>
        <span className="font-mono text-neutral-200">{tokens.total} tok</span>
      </div>
    </div>
  );
}
