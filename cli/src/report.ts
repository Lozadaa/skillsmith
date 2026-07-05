// Non-interactive plain report for pipes/CI (or --report). Colored only when the
// theme allows; otherwise pure text. main() derives the exit code separately.
import type { AnalyzedSkill } from "./analyze";
import type { Theme } from "./tui/theme";
import type { Severity } from "../../lib/skill-lint";

const MARK: Record<Severity, string> = { error: "x", warning: "!", suggestion: "-" };

export interface ReportMeta {
  sourceLabel: string;
  profile: string;
}

export function renderReport(skills: AnalyzedSkill[], meta: ReportMeta, theme: Theme): string {
  const out: string[] = [];
  const dot = theme.caps.unicode ? "·" : "-";
  out.push(
    theme.bold(theme.fg("#FF8A4A", "skillsmith")) +
      `  ${meta.sourceLabel} ${dot} ${skills.length} skills ${dot} profile ${meta.profile}`
  );
  out.push("");

  const nameW = Math.min(32, Math.max(8, ...skills.map((s) => s.dirName.length)));
  for (const s of skills) {
    const name = s.dirName.slice(0, nameW).padEnd(nameW);
    if (s.outcome.kind !== "skill") {
      out.push(`  ${name}  ${theme.dim("not a skill")}`);
      continue;
    }
    const { value, band } = s.outcome.score;
    const n = s.outcome.findings.length;
    out.push(
      `  ${name}  ${theme.bar(value, 10)} ${theme.band(band, String(value).padStart(3))}  ` +
        theme.band(band, band.padEnd(11)) +
        theme.dim(`${n} finding${n === 1 ? "" : "s"}`)
    );
  }
  out.push("");

  for (const s of skills) {
    if (s.outcome.kind !== "skill" || !s.outcome.findings.length) continue;
    const bar = theme.caps.unicode ? "▍" : "|";
    out.push(`${theme.fg("#FF8A4A", bar)}${theme.bold(s.dirName)} (${s.outcome.score.value})`);
    for (const f of s.outcome.findings) {
      const loc = f.line ? theme.dim(` (${f.file ?? "SKILL.md"}:${f.line})`) : "";
      out.push(`  ${theme.severity(f.severity, MARK[f.severity])} [${f.ruleId}] ${f.message}${loc}`);
      out.push(`     ${theme.dim("fix:")} ${f.howToFix}`);
    }
    const t = s.outcome.tokens;
    out.push(
      theme.dim(
        `     tokens: metadata ${t.metadata} ${dot} body ${t.body} ${dot} references ${t.references} ${dot} scripts ${t.scriptFiles} files`
      )
    );
    out.push("");
  }
  return out.join("\n");
}
