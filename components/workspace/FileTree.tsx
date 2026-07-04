"use client";

import { useState } from "react";
import type { SkillFile } from "@/lib/skill-lint";
import { useLocale } from "@/components/LocaleProvider";

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
  const { t } = useLocale();
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
                    ? "bg-ink text-paper"
                    : "text-ink-soft hover:bg-ink/5"
                }`}
              >
                {f.path}
              </button>
              {f.path !== "SKILL.md" && (
                <button
                  type="button"
                  aria-label={t("fileTree.deleteAria", { path: f.path })}
                  onClick={() => onDelete(f.path)}
                  className="ml-1 px-1 text-ink-soft opacity-0 hover:text-severity-error focus:opacity-100 group-hover:opacity-100"
                >
                  ×
                </button>
              )}
            </li>
          ))}
      </ul>
      <form onSubmit={submit} className="border-t-2 border-ink p-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t("fileTree.addPlaceholder")}
          aria-label={t("fileTree.newFileAria")}
          className="w-full rounded border-2 border-ink bg-paper px-2 py-1 font-mono text-xs text-ink placeholder:text-ink-soft/60"
        />
      </form>
    </div>
  );
}
