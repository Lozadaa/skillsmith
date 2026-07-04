import { lintSkill } from "@/lib/skill-lint";

export interface MiniLint {
  ok: boolean;
  score: number;
  errors: number;
  warnings: number;
  reason?: string;
}

/** Runs the full engine on just the SKILL.md text (references are absent → their rules stay quiet). */
export function miniLint(skillMd: string, dirName?: string): MiniLint {
  const r = lintSkill([{ path: "SKILL.md", content: skillMd }], { dirName });
  if (r.kind !== "skill") {
    return { ok: false, score: 0, errors: 0, warnings: 0, reason: r.reason };
  }
  return {
    ok: true,
    score: r.score.value,
    errors: r.findings.filter((f) => f.severity === "error").length,
    warnings: r.findings.filter((f) => f.severity === "warning").length,
  };
}
