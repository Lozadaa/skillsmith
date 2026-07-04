"use client";
import { useMemo, useState } from "react";
import type { PickerSkill } from "@/lib/github/importFlow";

type SortKey = "name" | "score" | "errors";

export default function CollectionAudit({ skills }: { skills: PickerSkill[] }) {
  const [open, setOpen] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [asc, setAsc] = useState(true); // score ascending = worst first

  const scanned = useMemo(() => skills.filter((s) => s.scanned && s.lint.ok), [skills]);

  const sorted = useMemo(() => {
    const dir = asc ? 1 : -1;
    return [...scanned].sort((a, b) => {
      if (sortKey === "name") return dir * a.ref.name.localeCompare(b.ref.name);
      if (sortKey === "errors") return dir * (a.lint.errors - b.lint.errors);
      return dir * (a.lint.score - b.lint.score);
    });
  }, [scanned, sortKey, asc]);

  function sortBy(key: SortKey) {
    if (key === sortKey) setAsc((v) => !v);
    else {
      setSortKey(key);
      setAsc(true);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="ink-btn mb-3 px-3 py-1 text-sm"
      >
        Audit whole collection ({scanned.length} scanned)
      </button>
    );
  }

  const header = (key: SortKey, label: string) => (
    <th className="py-2 pr-4">
      <button type="button" onClick={() => sortBy(key)} className="ink-underline font-medium text-ink hover:text-ember-deep">
        {label}
      </button>
    </th>
  );

  return (
    <div className="ink-panel mb-4 overflow-x-auto p-3">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-display text-lg text-ink">Collection audit — {scanned.length} skills</h2>
        <button type="button" onClick={() => setOpen(false)} className="ink-underline text-xs text-ink-soft hover:text-ember-deep">
          Hide
        </button>
      </div>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b-2 border-ink text-ink-soft">
            {header("name", "Skill")}
            {header("score", "Score")}
            {header("errors", "Errors")}
          </tr>
        </thead>
        <tbody>
          {sorted.map((s) => (
            <tr key={s.ref.dirPath || s.ref.name} className="border-b border-ink/30">
              <td className="py-2 pr-4 font-medium text-ink">{s.ref.name}</td>
              <td className="py-2 pr-4 font-display text-ink">{s.lint.score}</td>
              <td className="py-2 pr-4 text-ink">{s.lint.errors}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
