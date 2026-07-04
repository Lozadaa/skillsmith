import type { Finding, ParsedSkill, Profile, Rule, ScoreResult, SkillFile, TokenReport } from "./model";
import { parseSkill } from "./parser/skill";
import { runRules } from "./rules/engine";
import { frontmatterErrorRules } from "./rules/errors-frontmatter";
import { structureErrorRules } from "./rules/errors-structure";
import { computeScore } from "./score";
import { tokenReport } from "./tokens";

export type LintOutcome =
  | { kind: "skill"; skill: ParsedSkill; findings: Finding[]; score: ScoreResult; tokens: TokenReport }
  | { kind: "not-a-skill"; reason: string };

export interface LintOptions {
  profile?: Profile;
  dirName?: string;
}

/** Full rule catalog. Plan 2 appends the W and S rule packs here. */
export const allRules: Rule[] = [...frontmatterErrorRules, ...structureErrorRules];

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
