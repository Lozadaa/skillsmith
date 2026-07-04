"use client";

import { useState } from "react";
import type { SkillFile } from "@/lib/skill-lint";
import { downloadBlob, zipSkill } from "@/lib/zip";
import { useLocale } from "@/components/LocaleProvider";

function btnCls(): string {
  return "ink-btn px-3 py-1.5 text-sm font-medium";
}

export function ExportButtons({
  files,
  dirName,
  skillName,
  hasError,
}: {
  files: SkillFile[];
  dirName?: string;
  skillName?: string;
  hasError: boolean;
}) {
  const { t } = useLocale();
  const dir = ((dirName || skillName || "skill").trim() || "skill").replace(/[^a-zA-Z0-9._-]/g, "-");
  const [copied, setCopied] = useState(false);

  function onZip() {
    downloadBlob(`${dir}.zip`, zipSkill(files, dir), "application/zip");
  }
  function onSkill() {
    // A .skill file is a plain zip renamed (official format).
    downloadBlob(`${dir}.skill`, zipSkill(files, dir), "application/zip");
  }
  async function onCopy() {
    const skill = files.find((f) => f.path === "SKILL.md");
    if (!skill) return;
    try {
      await navigator.clipboard.writeText(skill.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      console.warn("ExportButtons: clipboard write failed", e);
    }
  }

  const gateTitle = hasError ? t("exportButtons.gateTitle") : undefined;
  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={onZip} disabled={hasError} title={gateTitle} className={btnCls()}>
        {t("exportButtons.zip")}
      </button>
      <button type="button" onClick={onSkill} disabled={hasError} title={gateTitle} className={btnCls()}>
        {t("exportButtons.skill")}
      </button>
      <button type="button" onClick={onCopy} className={btnCls()}>
        {copied ? t("exportButtons.copied") : t("exportButtons.copy")}
      </button>
    </div>
  );
}
