// Apply an AutoFix to disk. previewFix computes the change without writing;
// commitFix writes only the changed files, then re-lints from the new content.
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import type { Finding, Profile, SkillFile } from "../../lib/skill-lint";
import { relint, type AnalyzedSkill } from "./analyze";

export interface FixPreview {
  nextFiles: SkillFile[];
  changed: string[]; // relative paths that differ from current
  label: string;
}

/** Compute what a finding's fix would change. Returns null if it has no fix. */
export function previewFix(skill: AnalyzedSkill, finding: Finding): FixPreview | null {
  if (!finding.fix) return null;
  const nextFiles = finding.fix.apply(skill.files);
  const current = new Map(skill.files.map((f) => [f.path, f.content]));
  const changed = nextFiles
    .filter((f) => current.get(f.path) !== f.content)
    .map((f) => f.path);
  return { nextFiles, changed, label: finding.fix.label };
}

/** Write the changed files to disk and return the re-linted skill. */
export function commitFix(
  skill: AnalyzedSkill,
  preview: FixPreview,
  profile: Profile
): AnalyzedSkill {
  for (const rel of preview.changed) {
    const file = preview.nextFiles.find((f) => f.path === rel);
    if (!file) continue;
    const full = join(skill.dir, rel);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, file.content, "utf8");
  }
  return relint({ ...skill, files: preview.nextFiles }, profile);
}
