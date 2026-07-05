import type { Profile, Finding, LintOutcome } from "../../../lib/skill-lint";
import type { SourceRef } from "../scan";
import type { AnalyzedSkill } from "../analyze";
import type { FixPreview } from "../fixes";

export type Screen = "source" | "list" | "detail" | "confirm" | "help";

export interface State {
  sources: SourceRef[];
  source?: SourceRef;
  profile: Profile;
  skills: AnalyzedSkill[];
  screen: Screen;
  cursor: number; // index into sources (source screen) or skills (list)
  findingCursor: number; // index into the ordered findings of the open skill
  message?: string;
  confirm?: { preview: FixPreview };
  cols: number;
  rows: number;
}

const SEV_ORDER: Record<Finding["severity"], number> = { error: 0, warning: 1, suggestion: 2 };

/** Findings ordered error -> warning -> suggestion (stable). Shared by render + app. */
export function orderedFindings(outcome: LintOutcome): Finding[] {
  if (outcome.kind !== "skill") return [];
  return outcome.findings
    .map((f, i) => [f, i] as const)
    .sort((a, b) => SEV_ORDER[a[0].severity] - SEV_ORDER[b[0].severity] || a[1] - b[1])
    .map(([f]) => f);
}

export const selectedSkill = (s: State): AnalyzedSkill | undefined => s.skills[s.cursor];
