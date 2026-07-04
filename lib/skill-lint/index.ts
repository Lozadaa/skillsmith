import type { Finding, ParsedSkill, Profile, Rule, ScoreResult, SkillFile, TokenReport } from "./model";
import { parseSkill } from "./parser/skill";
import { runRules } from "./rules/engine";
import { frontmatterErrorRules } from "./rules/errors-frontmatter";
import { structureErrorRules } from "./rules/errors-structure";
import { warningDescriptionRules } from "./rules/warnings-description";
import { warningBodyRules } from "./rules/warnings-body";
import { warningStructureRules } from "./rules/warnings-structure";
import { warningFrontmatterRules } from "./rules/warnings-frontmatter";
import { suggestionMetadataRules } from "./rules/suggestions-metadata";
import { suggestionBodyRules } from "./rules/suggestions-body";
import { suggestionFileRules } from "./rules/suggestions-files";
import { computeScore } from "./score";
import { tokenReport } from "./tokens";

export type LintOutcome =
  | { kind: "skill"; skill: ParsedSkill; findings: Finding[]; score: ScoreResult; tokens: TokenReport }
  | { kind: "not-a-skill"; reason: string };

export interface LintOptions {
  profile?: Profile;
  dirName?: string;
}

/** Full rule catalog: errors E01–E12, warnings W01–W21, suggestions S01–S15. */
export const allRules: Rule[] = [
  ...frontmatterErrorRules,
  ...structureErrorRules,
  ...warningDescriptionRules,
  ...warningBodyRules,
  ...warningStructureRules,
  ...warningFrontmatterRules,
  ...suggestionMetadataRules,
  ...suggestionBodyRules,
  ...suggestionFileRules,
];

export function lintSkill(files: SkillFile[], opts: LintOptions = {}): LintOutcome {
  const outcome = parseSkill(files, { dirName: opts.dirName });
  if (outcome.kind === "not-a-skill") return outcome;
  const findings = runRules(outcome.skill, allRules, { profile: opts.profile ?? "generic" });
  return {
    kind: "skill",
    skill: outcome.skill,
    findings,
    score: computeScore(findings),
    tokens: tokenReport(outcome.skill),
  };
}

export * from "./model";
export { estimateTokens, tokenReport } from "./tokens";
export { computeScore, SCORE_WEIGHTS } from "./score";
export { parseSkill } from "./parser/skill";
