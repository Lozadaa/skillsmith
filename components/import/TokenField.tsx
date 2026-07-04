"use client";

import { useLocale } from "@/components/LocaleProvider";

export default function TokenField({
  token,
  onChange,
  open,
  onToggle,
}: {
  token: string;
  onChange: (t: string) => void;
  open: boolean;
  onToggle: (open: boolean) => void;
}) {
  const { t } = useLocale();
  return (
    <div className="mt-2 text-sm">
      <button type="button" onClick={() => onToggle(!open)} className="ink-underline text-ink hover:text-ember-deep">
        {open ? t("tokenField.hide") : t("tokenField.toggleLabel")}
      </button>
      {open && (
        <div className="mt-2 flex flex-col gap-1">
          <a href="/api/oauth/login" className="ink-btn self-start px-3 py-1.5 text-sm font-medium">
            {t("tokenField.signIn")}
          </a>
          <label htmlFor="gh-token" className="mt-2 text-ink-soft">
            {t("tokenField.orPaste")}
          </label>
          <input
            id="gh-token"
            type="password"
            value={token}
            onChange={(e) => onChange(e.target.value)}
            placeholder={t("tokenField.placeholder")}
            className="rounded border-2 border-ink bg-paper px-2 py-1 text-ink outline-none focus:border-ember"
            autoComplete="off"
          />
          <span className="text-xs text-ink-soft">{t("tokenField.storageNote")}</span>
        </div>
      )}
    </div>
  );
}
