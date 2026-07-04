import type { Finding, ParsedSkill, Rule, RuleContext } from "../model";
import { mk } from "./util";

const SEVERITY_ORDER = { error: 0, warning: 1, suggestion: 2 } as const;

export function runRules(skill: ParsedSkill, rules: Rule[], ctx: RuleContext): Finding[] {
  const findings: Finding[] = [];
  for (const rule of rules) {
    if (rule.profiles && !rule.profiles.includes(ctx.profile)) continue;
    try {
      findings.push(...rule.check(skill, ctx));
    } catch (e) {
      findings.push(
        mk(
          rule.id,
          rule.severity,
          `Rule ${rule.id} hit an internal error and was skipped`,
          "A linter bug should never block your analysis — the remaining rules still ran.",
          `Report this: ${e instanceof Error ? e.message : String(e)}`
        )
      );
    }
  }
  return findings.sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || a.ruleId.localeCompare(b.ruleId)
  );
}
