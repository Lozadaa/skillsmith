"use client";

import { useState } from "react";
import type { SkillFile } from "@/lib/skill-lint";

export function FileTree({
  files,
  activePath,
  onSelect,
  onAdd,
  onDelete,
}: {
  files: SkillFile[];
  activePath: string;
  onSelect: (path: string) => void;
  onAdd: (path: string) => void;
  onDelete: (path: string) => void;
}) {
  const [draft, setDraft] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const path = draft.trim();
    if (!path) return;
    onAdd(path);
    setDraft("");
  }

  return (
    <div className="flex h-full flex-col">
      <ul className="flex-1 overflow-auto p-2">
        {[...files]
          .sort((a, b) => a.path.localeCompare(b.path))
          .map((f) => (
            <li key={f.path} className="group flex items-center">
              <button
                type="button"
                onClick={() => onSelect(f.path)}
                className={`flex-1 truncate rounded px-2 py-1 text-left font-mono text-xs ${
                  f.path === activePath
                    ? "bg-neutral-800 text-neutral-100"
                    : "text-neutral-400 hover:bg-neutral-900"
                }`}
              >
                {f.path}
              </button>
              {f.path !== "SKILL.md" && (
                <button
                  type="button"
                  aria-label={`Delete ${f.path}`}
                  onClick={() => onDelete(f.path)}
                  className="ml-1 px-1 text-neutral-600 opacity-0 hover:text-red-400 group-hover:opacity-100"
                >
                  ×
                </button>
              )}
            </li>
          ))}
      </ul>
      <form onSubmit={submit} className="border-t border-neutral-800 p-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="add file e.g. references/api.md"
          aria-label="New file path"
          className="w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1 font-mono text-xs text-neutral-100 placeholder:text-neutral-600"
        />
      </form>
    </div>
  );
}
