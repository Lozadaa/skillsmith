"use client";

import { useLocale } from "@/components/LocaleProvider";

export function NotASkillPanel({
  reason,
  onStartTemplate,
}: {
  reason: string;
  onStartTemplate: () => void;
}) {
  const { t } = useLocale();
  return (
    <div className="flex flex-1 items-center justify-center p-8 text-center">
      <div className="ink-panel max-w-md p-6">
        <h2 className="font-display text-xl text-severity-warning">{t("notASkill.title")}</h2>
        <p className="mt-2 text-sm text-ink">{reason}</p>
        <button
          type="button"
          onClick={onStartTemplate}
          className="ink-btn mt-4 px-4 py-2 text-sm"
        >
          {t("notASkill.startTemplate")}
        </button>
      </div>
    </div>
  );
}
