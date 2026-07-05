// Interactive experience built on @clack/prompts: a polished, guided flow that
// walks skills one by one, with a spinner during analysis, colored score bars,
// boxed finding panels, and confirm-gated fixes. Used only on a real TTY; CI and
// pipes go through the plain report in report.ts instead.
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import * as p from "@clack/prompts";
import pc from "picocolors";
import type { Finding, Profile, ScoreResult } from "../../lib/skill-lint";
import { analyzeSource, orderedFindings, relint, type AnalyzedSkill } from "./analyze";
import { listSkillDirs, type SourceRef } from "./scan";
import { previewFix, commitFix } from "./fixes";
import { toJson, toMarkdown, writeReport } from "./export";

const ember = (s: string) => `\x1b[38;2;232;89;12m${s}\x1b[39m`;
type Band = ScoreResult["band"];
const bandColor: Record<Band, (s: string) => string> = {
  excellent: pc.green,
  good: pc.cyan,
  "needs-work": pc.yellow,
  poor: pc.red,
};
const sevColor: Record<Finding["severity"], (s: string) => string> = {
  error: pc.red,
  warning: pc.yellow,
  suggestion: pc.blue,
};
const sevMark: Record<Finding["severity"], string> = { error: "✖", warning: "⚠", suggestion: "•" };

function bar(value: number, width = 10): string {
  const filled = Math.max(0, Math.min(width, Math.round((value / 100) * width)));
  const color = value >= 85 ? pc.green : value >= 60 ? pc.cyan : value >= 40 ? pc.yellow : pc.red;
  return color("█".repeat(filled)) + pc.dim("░".repeat(width - filled));
}

function skillLabel(k: AnalyzedSkill): string {
  const name = k.dirName.length > 26 ? k.dirName.slice(0, 25) + "…" : k.dirName.padEnd(26);
  if (k.outcome.kind !== "skill") return `${name} ${pc.dim("not a skill")}`;
  const { value, band } = k.outcome.score;
  const n = k.outcome.findings.length;
  return `${name} ${bar(value)} ${bandColor[band](String(value).padStart(3))} ${pc.dim(
    band.padEnd(11)
  )} ${pc.dim(`${n} finding${n === 1 ? "" : "s"}`)}`;
}

function findingsPanel(k: AnalyzedSkill): string {
  if (k.outcome.kind !== "skill") return pc.dim("This folder is not a skill.");
  const o = k.outcome;
  const lines: string[] = [];
  const findings = orderedFindings(o.findings);
  if (!findings.length) lines.push(pc.green("✔ clean — passes every enabled rule"));
  for (const f of findings) {
    const loc = f.line ? pc.dim(` (${f.file ?? "SKILL.md"}:${f.line})`) : "";
    const wrench = f.fix ? ember(" ⚒") : "";
    lines.push(`${sevColor[f.severity](sevMark[f.severity])} ${pc.dim(`[${f.ruleId}]`)} ${f.message}${loc}${wrench}`);
    lines.push(pc.dim(`  ${f.howToFix}`));
  }
  const t = o.tokens;
  lines.push("");
  lines.push(
    pc.dim(
      `tokens · metadata ${t.metadata} · body ${t.body} · references ${t.references} · scripts ${t.scriptFiles} · total ${t.total}`
    )
  );
  return lines.join("\n");
}

const bail = (v: unknown): boolean => {
  if (p.isCancel(v)) {
    p.cancel("Cancelled.");
    return true;
  }
  return false;
};

async function chooseSource(sources: SourceRef[], profile: Profile): Promise<SourceRef | null> {
  const options = [
    ...sources.map((s, i) => ({
      value: `src:${i}`,
      label: s.label,
      hint: `${listSkillDirs(s.root).length} skills`,
    })),
    { value: "custom", label: `${ember("＋")} enter a custom path…`, hint: "any folder" },
  ];
  const choice = await p.select({ message: "Choose a source", options, maxItems: 12 });
  if (bail(choice)) return null;

  if (choice === "custom") {
    const typed = await p.text({
      message: "Path to a skill, or a folder that contains skills",
      placeholder: "~/my-skills",
      validate: (v) => (v.trim() ? undefined : "Enter a path"),
    });
    if (bail(typed)) return null;
    const raw = (typed as string).trim();
    const path = raw.startsWith("~") ? join(homedir(), raw.slice(1)) : raw;
    if (!existsSync(path)) {
      p.log.error(`Path not found: ${path}`);
      return chooseSource(sources, profile);
    }
    if (!listSkillDirs(path).length) {
      p.log.error(`No skills found at ${path}`);
      return chooseSource(sources, profile);
    }
    return { id: "path", label: path, root: path };
  }
  return sources[Number((choice as string).split(":")[1])];
}

async function fixFlow(skill: AnalyzedSkill, profile: Profile): Promise<AnalyzedSkill> {
  if (skill.outcome.kind !== "skill") return skill;
  const fixable = orderedFindings(skill.outcome.findings).filter((f) => f.fix);
  if (!fixable.length) {
    p.log.warn("No auto-fixable findings on this skill.");
    return skill;
  }
  const pick = await p.select({
    message: "Which finding?",
    options: fixable.map((f, i) => ({
      value: String(i),
      label: `${sevColor[f.severity](sevMark[f.severity])} ${f.message}`,
      hint: f.fix!.label,
    })),
    maxItems: 10,
  });
  if (bail(pick)) return skill;
  const preview = previewFix(skill, fixable[Number(pick)]);
  if (!preview || !preview.changed.length) {
    p.log.warn("That fix produces no change.");
    return skill;
  }
  const ok = await p.confirm({ message: `Write ${preview.changed.join(", ")} to disk?` });
  if (bail(ok) || !ok) return skill;
  const s = p.spinner();
  s.start("Tempering");
  const updated = commitFix(skill, preview, profile);
  s.stop(pc.green(`Applied · ${preview.label}`));
  return updated;
}

async function inspect(skills: AnalyzedSkill[], idx: number, profile: Profile): Promise<void> {
  for (;;) {
    const skill = skills[idx];
    const title =
      skill.outcome.kind === "skill"
        ? `${skill.dirName} · ${bandColor[skill.outcome.score.band](
            `${skill.outcome.score.value}/100 ${skill.outcome.score.band}`
          )}`
        : skill.dirName;
    p.note(findingsPanel(skill), title);
    const fixable =
      skill.outcome.kind === "skill" ? orderedFindings(skill.outcome.findings).filter((f) => f.fix).length : 0;
    const action = await p.select({
      message: "Now what?",
      options: [
        ...(fixable ? [{ value: "fix", label: `${ember("⚒")} Apply a fix`, hint: `${fixable} available` }] : []),
        { value: "back", label: "← Back to the list" },
      ],
    });
    if (bail(action) || action === "back") return;
    if (action === "fix") skills[idx] = await fixFlow(skill, profile);
  }
}

async function exportFlow(skills: AnalyzedSkill[], source: SourceRef, profile: Profile): Promise<void> {
  const fmt = await p.select({
    message: "Export format",
    options: [
      { value: "md", label: "Markdown", hint: "human-readable" },
      { value: "json", label: "JSON", hint: "machine-readable" },
    ],
  });
  if (bail(fmt)) return;
  const path = `./skillsmith-report.${fmt}`;
  const meta = { source: source.label, profile, generatedAt: new Date().toISOString() };
  writeReport(path, fmt === "json" ? toJson(skills, meta) : toMarkdown(skills, meta));
  p.log.success(`Exported ${pc.underline(path)}`);
}

export async function runInteractive(sources: SourceRef[], initialProfile: Profile): Promise<void> {
  p.intro(`${ember("⚒ skillsmith")} ${pc.dim("· agent-skill analyzer")}`);
  let profile = initialProfile;

  const source = await chooseSource(sources, profile);
  if (!source) return;

  const spin = p.spinner();
  spin.start(`Inspecting ${source.label}`);
  let skills = analyzeSource(source, profile);
  spin.stop(`${skills.length} skill${skills.length === 1 ? "" : "s"} · profile ${pc.cyan(profile)}`);

  if (!skills.length) {
    p.outro(pc.dim("Nothing to analyze here."));
    return;
  }

  for (;;) {
    const choice = await p.select({
      message: "Inspect a skill",
      maxItems: 12,
      options: [
        ...skills.map((k, i) => ({ value: `skill:${i}`, label: skillLabel(k) })),
        { value: "profile", label: `↻ Switch profile ${pc.dim(`(now: ${profile})`)}` },
        { value: "export", label: "⬇ Export report" },
        { value: "quit", label: "✖ Quit" },
      ],
    });
    if (bail(choice) || choice === "quit") break;
    if (choice === "profile") {
      profile = profile === "generic" ? "claude-code-plugin" : "generic";
      skills = skills.map((k) => relint(k, profile));
      p.log.info(`Profile: ${pc.cyan(profile)}`);
      continue;
    }
    if (choice === "export") {
      await exportFlow(skills, source, profile);
      continue;
    }
    await inspect(skills, Number((choice as string).split(":")[1]), profile);
  }
  p.outro(ember("Forge better skills."));
}
