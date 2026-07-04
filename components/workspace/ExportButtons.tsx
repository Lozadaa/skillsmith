"use client";

import { useState } from "react";
import type { SkillFile } from "@/lib/skill-lint";
import { downloadBlob, zipSkill } from "@/lib/zip";

function btnCls(disabled: boolean): string {
  return `rounded-md border px-3 py-1.5 text-sm font-medium ${
    disabled
      ? "cursor-not-allowed border-neutral-800 bg-neutral-900 text-neutral-600"
      : "border-neutral-700 bg-neutral-800 text-neutral-100 hover:bg-neutral-700"
  }`;
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

  const gateTitle = hasError ? "Fix every error before exporting a package" : undefined;
  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={onZip} disabled={hasError} title={gateTitle} className={btnCls(hasError)}>
        Download .zip
      </button>
      <button type="button" onClick={onSkill} disabled={hasError} title={gateTitle} className={btnCls(hasError)}>
        Download .skill
      </button>
      <button type="button" onClick={onCopy} className={btnCls(false)}>
        {copied ? "Copied!" : "Copy SKILL.md"}
      </button>
    </div>
  );
}
