// Wraps the lib/skill-lint engine: reads each skill folder from a source and
// runs lintSkill against it. Holds the in-memory files so profile toggles and
// applied fixes can re-lint without touching disk again.
import { lintSkill, type LintOutcome, type Profile, type SkillFile } from "../../lib/skill-lint";
import { listSkillDirs, readSkillFiles, type SourceRef } from "./scan";

export interface AnalyzedSkill {
  dirName: string;
  dir: string; // absolute path on disk
  files: SkillFile[]; // current in-memory files (updated after a fix)
  outcome: LintOutcome;
}

const lint = (dirName: string, files: SkillFile[], profile: Profile): LintOutcome =>
  lintSkill(files, { profile, dirName });

/** Analyze every skill folder under a source. */
export function analyzeSource(source: SourceRef, profile: Profile): AnalyzedSkill[] {
  return listSkillDirs(source.root).map(({ dirName, dir }) => {
    const files = readSkillFiles(dir);
    return { dirName, dir, files, outcome: lint(dirName, files, profile) };
  });
}

/** Re-lint one skill's current in-memory files under a (possibly new) profile. */
export function relint(skill: AnalyzedSkill, profile: Profile): AnalyzedSkill {
  return { ...skill, outcome: lint(skill.dirName, skill.files, profile) };
}

/** Count of error-severity findings across a set — drives the report exit code. */
export function errorCount(skills: AnalyzedSkill[]): number {
  let n = 0;
  for (const s of skills) {
    if (s.outcome.kind !== "skill") continue;
    for (const f of s.outcome.findings) if (f.severity === "error") n++;
  }
  return n;
}
