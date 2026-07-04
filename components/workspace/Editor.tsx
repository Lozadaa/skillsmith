"use client";

import type { SkillFile } from "@/lib/skill-lint";

export function Editor({
  file,
  onChange,
}: {
  file: SkillFile | undefined;
  onChange: (content: string) => void;
}) {
  if (!file) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-neutral-500">
        No file selected.
      </div>
    );
  }
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-neutral-800 px-3 py-1.5 font-mono text-xs text-neutral-500">
        {file.path}
      </div>
      <textarea
        value={file.content}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        aria-label={`Editor for ${file.path}`}
        className="w-full flex-1 resize-none bg-neutral-950 p-4 font-mono text-sm leading-relaxed text-neutral-100 outline-none"
      />
    </div>
  );
}
