// Serialize an analyzed source to JSON or Markdown. Findings are emitted without
// their AutoFix (functions aren't serializable, and a report is read-only).
import { writeFileSync } from "node:fs";
import type { Finding } from "../../lib/skill-lint";
import type { AnalyzedSkill } from "./analyze";

export interface ExportMeta {
  source: string;
  profile: string;
  generatedAt: string;
}

const plainFinding = (f: Finding) => ({
  ruleId: f.ruleId,
  severity: f.severity,
  message: f.message,
  why: f.why,
  howToFix: f.howToFix,
  file: f.file ?? "SKILL.md",
  line: f.line,
});

export function toJson(skills: AnalyzedSkill[], meta: ExportMeta): string {
  const payload = {
    ...meta,
    skills: skills.map((s) =>
      s.outcome.kind === "skill"
        ? {
            dirName: s.dirName,
            score: s.outcome.score,
            tokens: s.outcome.tokens,
            findings: s.outcome.findings.map(plainFinding),
          }
        : { dirName: s.dirName, notASkill: s.outcome.reason }
    ),
  };
  return JSON.stringify(payload, null, 2) + "\n";
}

export function toMarkdown(skills: AnalyzedSkill[], meta: ExportMeta): string {
  const lines: string[] = [];
  lines.push(`# Skillsmith report`, "");
  lines.push(`- **Source:** ${meta.source}`);
  lines.push(`- **Profile:** ${meta.profile}`);
  lines.push(`- **Generated:** ${meta.generatedAt}`, "");
  lines.push(`| Skill | Score | Band | Findings |`, `|---|---|---|---|`);
  for (const s of skills) {
    if (s.outcome.kind !== "skill") {
      lines.push(`| ${s.dirName} | – | not a skill | – |`);
      continue;
    }
    lines.push(
      `| ${s.dirName} | ${s.outcome.score.value}/100 | ${s.outcome.score.band} | ${s.outcome.findings.length} |`
    );
  }
  lines.push("");
  for (const s of skills) {
    if (s.outcome.kind !== "skill") continue;
    lines.push(`## ${s.dirName} — ${s.outcome.score.value}/100 (${s.outcome.score.band})`, "");
    const { metadata, body, references, scriptFiles, total } = s.outcome.tokens;
    lines.push(
      `Tokens: metadata ${metadata} · body ${body} · references ${references} · scripts ${scriptFiles} files · total ${total}`,
      ""
    );
    if (!s.outcome.findings.length) {
      lines.push("No findings.", "");
      continue;
    }
    for (const f of s.outcome.findings) {
      const loc = f.line ? ` (${f.file ?? "SKILL.md"}:${f.line})` : "";
      lines.push(`- **${f.severity}** [${f.ruleId}] ${f.message}${loc}`);
      lines.push(`  - Why: ${f.why}`);
      lines.push(`  - Fix: ${f.howToFix}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

export function writeReport(path: string, content: string): void {
  writeFileSync(path, content, "utf8");
}
