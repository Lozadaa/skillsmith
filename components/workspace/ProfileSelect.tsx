"use client";

import type { Profile } from "@/lib/skill-lint";

export function ProfileSelect({ value, onChange }: { value: Profile; onChange: (p: Profile) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm text-ink-soft">
      <span className="hidden sm:inline">Profile</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as Profile)}
        aria-label="Lint profile"
        className="rounded-md border-2 border-ink bg-paper px-2 py-1 text-sm text-ink"
      >
        <option value="generic">Generic (agentskills.io)</option>
        <option value="claude-code-plugin">Claude Code plugin</option>
      </select>
    </label>
  );
}
