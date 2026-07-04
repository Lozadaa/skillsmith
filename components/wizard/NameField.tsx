"use client";

import { validateName } from "@/lib/wizard/name";

export function NameField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const check = validateName(value);
  const invalid = value.length > 0 && !check.ok;
  return (
    <div>
      <label className="block text-sm font-medium text-neutral-200">Skill name (kebab-case)</label>
      <input
        data-testid="name-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="processing-pdfs"
        className={
          "mt-1 w-full rounded border bg-neutral-950 px-3 py-2 text-sm text-neutral-100 outline-none " +
          (invalid ? "border-red-500" : "border-neutral-800 focus:border-indigo-400")
        }
      />
      {invalid && (
        <p data-testid="name-error" className="mt-1 text-xs text-red-400">
          {check.message}
        </p>
      )}
      {value.length > 0 && check.ok && <p className="mt-1 text-xs text-emerald-400">Valid name.</p>}
    </div>
  );
}
