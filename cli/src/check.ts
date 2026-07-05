// Non-interactive linter, ESLint-style: group findings per skill, print
// line/severity/message/rule, a problem summary, and return a CI exit code.
// Powers `skillsmith check` (and `lint`).
import type { Finding, Severity } from "../../lib/skill-lint";
import { orderedFindings, type AnalyzedSkill } from "./analyze";
import type { Theme } from "./tui/theme";

export interface CheckOptions {
  maxWarnings: number; // fail if warnings exceed this (default Infinity)
  quiet: boolean; // show/consider errors only
  format: "stylish" | "compact" | "json";
}

export interface CheckResult {
  text: string;
  exitCode: number;
}

interface Counts {
  error: number;
  warning: number;
  suggestion: number;
}

const sevWord: Record<Severity, string> = { error: "error", warning: "warning", suggestion: "suggest" };

function tally(skills: AnalyzedSkill[], quiet: boolean): Counts {
  const c: Counts = { error: 0, warning: 0, suggestion: 0 };
  for (const s of skills) {
    if (s.outcome.kind !== "skill") continue;
    for (const f of s.outcome.findings) {
      if (quiet && f.severity !== "error") continue;
      c[f.severity]++;
    }
  }
  return c;
}

const visibleFindings = (s: AnalyzedSkill, quiet: boolean): Finding[] =>
  s.outcome.kind === "skill"
    ? orderedFindings(s.outcome.findings).filter((f) => !quiet || f.severity === "error")
    : [];

const relPath = (dirName: string, f: Finding): string => `${dirName}/${f.file ?? "SKILL.md"}`;

function stylish(skills: AnalyzedSkill[], opts: CheckOptions, t: Theme): string {
  const paintSev = (sev: Severity, s: string) => t.severity(sev, s);
  const out: string[] = [];
  for (const s of skills) {
    const findings = visibleFindings(s, opts.quiet);
    if (!findings.length) continue;
    out.push(t.bold(`${s.dirName}/SKILL.md`));
    const locW = Math.max(...findings.map((f) => String(f.line ?? "").length), 1);
    for (const f of findings) {
      const loc = (f.line ? `${f.line}` : "").padStart(locW);
      const where = f.file && f.file !== "SKILL.md" ? t.dim(` in ${f.file}`) : "";
      out.push(
        `  ${t.dim(loc)}  ${paintSev(f.severity, sevWord[f.severity].padEnd(7))}  ${f.message}  ${t.dim(
          f.ruleId
        )}${where}`
      );
    }
    out.push("");
  }
  return out.join("\n");
}

function compact(skills: AnalyzedSkill[], opts: CheckOptions): string {
  const lines: string[] = [];
  for (const s of skills) {
    for (const f of visibleFindings(s, opts.quiet)) {
      const line = f.line ? `:${f.line}` : "";
      lines.push(`${relPath(s.dirName, f)}${line}: ${f.severity} ${f.message} [${f.ruleId}]`);
    }
  }
  return lines.join("\n");
}

function json(skills: AnalyzedSkill[], opts: CheckOptions): string {
  return JSON.stringify(
    skills
      .filter((s) => s.outcome.kind === "skill")
      .map((s) => ({
        dirName: s.dirName,
        score: s.outcome.kind === "skill" ? s.outcome.score : null,
        messages: visibleFindings(s, opts.quiet).map((f) => ({
          ruleId: f.ruleId,
          severity: f.severity,
          message: f.message,
          file: f.file ?? "SKILL.md",
          line: f.line ?? null,
        })),
      })),
    null,
    2
  );
}

function summary(c: Counts, opts: CheckOptions, t: Theme): string {
  const total = c.error + c.warning + c.suggestion;
  if (total === 0) return t.severity("suggestion", "") + t.bold(t.fg("#3fb950", "✔ no problems"));
  const parts = [
    `${c.error} error${c.error === 1 ? "" : "s"}`,
    `${c.warning} warning${c.warning === 1 ? "" : "s"}`,
    ...(opts.quiet ? [] : [`${c.suggestion} suggestion${c.suggestion === 1 ? "" : "s"}`]),
  ];
  const head = c.error ? t.severity("error", "✖") : t.severity("warning", "⚠");
  let line = `${head} ${t.bold(`${total} problem${total === 1 ? "" : "s"}`)} (${parts.join(", ")})`;
  if (Number.isFinite(opts.maxWarnings) && c.warning > opts.maxWarnings) {
    line += "\n" + t.severity("error", `✖ too many warnings (max ${opts.maxWarnings})`);
  }
  return line;
}

export function runCheck(skills: AnalyzedSkill[], opts: CheckOptions, theme: Theme): CheckResult {
  const counts = tally(skills, opts.quiet);
  let body: string;
  if (opts.format === "json") body = json(skills, opts);
  else if (opts.format === "compact") body = compact(skills, opts);
  else body = stylish(skills, opts, theme);

  const failWarnings = Number.isFinite(opts.maxWarnings) && counts.warning > opts.maxWarnings;
  const exitCode = counts.error > 0 || failWarnings ? 1 : 0;

  if (opts.format === "json") return { text: body, exitCode };
  const tail = summary(counts, opts, theme);
  const text = body.trim() ? `${body.replace(/\n+$/, "")}\n\n${tail}` : tail;
  return { text, exitCode };
}
