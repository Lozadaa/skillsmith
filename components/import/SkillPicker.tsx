"use client";
import type { PickerSkill } from "@/lib/github/importFlow";
import { useLocale } from "@/components/LocaleProvider";

const ORIGIN_LABEL: Record<string, string> = {
  "skills-dir": "skills-dir",
  "harness-dir": "harness-dir",
  "category-dir": "category-dir",
  root: "root",
  plugin: "plugin",
};

export default function SkillPicker({
  skills,
  busyDir,
  onOpen,
}: {
  skills: PickerSkill[];
  busyDir: string | null;
  onOpen: (skill: PickerSkill) => void;
}) {
  const { t } = useLocale();
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b-2 border-ink text-ink-soft">
            <th className="py-2 pr-4">{t("skillPicker.headers.skill")}</th>
            <th className="py-2 pr-4">{t("skillPicker.headers.origin")}</th>
            <th className="py-2 pr-4">{t("skillPicker.headers.path")}</th>
            <th className="py-2 pr-4">{t("skillPicker.headers.score")}</th>
            <th className="py-2 pr-4">{t("skillPicker.headers.issues")}</th>
            <th className="py-2" />
          </tr>
        </thead>
        <tbody>
          {skills.map((s) => (
            <tr key={s.ref.dirPath || s.ref.name} className="border-b border-ink/30">
              <td className="py-2 pr-4 font-medium text-ink">
                {s.ref.name}
                {s.ref.viaSymlink && <span className="ml-1 text-xs text-ink-soft">{t("skillPicker.symlink")}</span>}
              </td>
              <td className="py-2 pr-4">
                <span className="rounded border border-ink px-2 py-0.5 text-xs text-ink">{ORIGIN_LABEL[s.ref.origin]}</span>
                {s.ref.pluginName && <span className="ml-1 text-xs text-ink-soft">{s.ref.pluginName}</span>}
              </td>
              <td className="py-2 pr-4 font-mono text-xs text-ink-soft">{s.ref.dirPath || t("skillPicker.root")}</td>
              <td className="py-2 pr-4 font-display text-ink" data-testid={`mini-score-${s.ref.dirPath || s.ref.name}`}>
                {s.scanned && s.lint.ok ? s.lint.score : "—"}
              </td>
              <td className="py-2 pr-4 text-xs">
                {s.scanned && s.lint.ok ? (
                  <span>
                    <span className="text-severity-error">{s.lint.errors}E</span> /{" "}
                    <span className="text-severity-warning">{s.lint.warnings}W</span>
                  </span>
                ) : (
                  <span className="text-ink-soft">{s.lint.reason ?? t("skillPicker.notScanned")}</span>
                )}
              </td>
              <td className="py-2 text-right">
                <button
                  type="button"
                  disabled={busyDir !== null}
                  onClick={() => onOpen(s)}
                  className="ink-btn px-3 py-1 text-sm"
                >
                  {busyDir === s.ref.dirPath ? t("skillPicker.opening") : t("skillPicker.open")}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
