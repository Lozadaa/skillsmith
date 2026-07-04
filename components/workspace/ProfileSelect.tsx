"use client";

import type { Profile } from "@/lib/skill-lint";
import { useLocale } from "@/components/LocaleProvider";

export function ProfileSelect({ value, onChange }: { value: Profile; onChange: (p: Profile) => void }) {
  const { t } = useLocale();
  return (
    <label className="flex items-center gap-2 text-sm text-ink-soft">
      <span className="hidden sm:inline">{t("profileSelect.label")}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as Profile)}
        aria-label={t("profileSelect.ariaLabel")}
        className="rounded-md border-2 border-ink bg-paper px-2 py-1 text-sm text-ink"
      >
        <option value="generic">{t("profileSelect.generic")}</option>
        <option value="claude-code-plugin">{t("profileSelect.pluginProfile")}</option>
      </select>
    </label>
  );
}
