"use client";

import { validateName } from "@/lib/wizard/name";
import { useLocale } from "@/components/LocaleProvider";

export function NameField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t } = useLocale();
  const check = validateName(value);
  const invalid = value.length > 0 && !check.ok;
  return (
    <div>
      <label className="block text-sm font-medium text-ink">{t("wizard.name.label")}</label>
      <input
        data-testid="name-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t("wizard.name.placeholder")}
        className={
          "mt-1 w-full rounded border-2 bg-paper px-3 py-2 text-sm text-ink outline-none " +
          (invalid ? "border-severity-error" : "border-ink focus:border-ember")
        }
      />
      {invalid && (
        <p data-testid="name-error" className="mt-1 text-xs text-severity-error">
          {check.message}
        </p>
      )}
      {value.length > 0 && check.ok && <p className="mt-1 text-xs text-ink-soft">{t("wizard.name.valid")}</p>}
    </div>
  );
}
