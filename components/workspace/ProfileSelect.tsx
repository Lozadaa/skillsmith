"use client";

import type { Profile } from "@/lib/skill-lint";

export function ProfileSelect({ value, onChange }: { value: Profile; onChange: (p: Profile) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm text-neutral-400">
      <span className="hidden sm:inline">Profile</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as Profile)}
        aria-label="Lint profile"
        className="rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm text-neutral-100"
      >
        <option value="generic">Generic (agentskills.io)</option>
        <option value="claude-code-plugin">Claude Code plugin</option>
      </select>
    </label>
  );
}
