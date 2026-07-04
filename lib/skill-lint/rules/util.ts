import type { Finding, Severity } from "../model";

export function mk(
  id: string,
  severity: Severity,
  message: string,
  why: string,
  howToFix: string,
  extra: Partial<Finding> = {}
): Finding {
  return { ruleId: id, severity, message, why, howToFix, ...extra };
}
