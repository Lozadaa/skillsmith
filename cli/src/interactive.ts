// Interactive experience built on @clack/prompts, skinned to the ink/forge line
// (docs/design/ink-style.md): a night-forge blacksmith banner, ember accents,
// exact severity/score inks, and a navigable findings browser. TTY only; CI and
// pipes go through the plain report in report.ts instead.
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import * as p from "@clack/prompts";
import type { Finding, Profile, ScoreResult } from "../../lib/skill-lint";
import { analyzeSource, orderedFindings, relint, type AnalyzedSkill } from "./analyze";
import { listSkillDirs, type SourceRef } from "./scan";
import { previewFix, commitFix } from "./fixes";
import { toJson, toMarkdown, writeReport } from "./export";
import { blacksmith } from "./art";

// ── ink/forge truecolor palette (night-forge values) ──────────────────────────
const tc = (r: number, g: number, b: number) => (s: string) => `\x1b[38;2;${r};${g};${b}m${s}\x1b[39m`;
const ink = {
  ember: tc(232, 89, 12), // #E8590C — the one hot accent
  bone: tc(234, 228, 216), // #EAE4D8 — chalk linework
  soft: tc(163, 154, 139), // #A39A8B — secondary / dim
  error: tc(229, 72, 77), // #E5484D
  warning: tc(217, 160, 63), // #D9A03F
  suggestion: tc(108, 169, 224), // #6CA9E0
};
const bold = (s: string) => `\x1b[1m${s}\x1b[22m`;
const underline = (s: string) => `\x1b[4m${s}\x1b[24m`;

type Band = ScoreResult["band"];
// Excellent earns the hot proof-mark (ember); the rest step down through bone,
// warning amber, error red — matching the ScoreBadge stamp semantics.
const bandPaint: Record<Band, (s: string) => string> = {
  excellent: ink.ember,
  good: ink.bone,
  "needs-work": ink.warning,
  poor: ink.error,
};
const sevPaint: Record<Finding["severity"], (s: string) => string> = {
  error: ink.error,
  warning: ink.warning,
  suggestion: ink.suggestion,
};
const sevMark: Record<Finding["severity"], string> = { error: "✖", warning: "⚠", suggestion: "•" };

function bar(value: number, width = 10): string {
  const filled = Math.max(0, Math.min(width, Math.round((value / 100) * width)));
  const paint = value >= 85 ? ink.ember : value >= 60 ? ink.bone : value >= 40 ? ink.warning : ink.error;
  return paint("█".repeat(filled)) + ink.soft("░".repeat(width - filled));
}

function skillLabel(k: AnalyzedSkill): string {
  const name = k.dirName.length > 26 ? k.dirName.slice(0, 25) + "…" : k.dirName.padEnd(26);
  if (k.outcome.kind !== "skill") return `${name} ${ink.soft("not a skill")}`;
  const { value, band } = k.outcome.score;
  const n = k.outcome.findings.length;
  return `${name} ${bar(value)} ${bandPaint[band](String(value).padStart(3))} ${ink.soft(
    band.padEnd(11)
  )} ${ink.soft(`${n} finding${n === 1 ? "" : "s"}`)}`;
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
    { value: "custom", label: `${ink.ember("＋")} enter a custom path…`, hint: "any folder" },
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

/** Navigable findings browser for one skill. Arrow through findings, ⏎ for
 *  details, and temper the fixable ones (⚒) in place. */
async function inspect(skills: AnalyzedSkill[], idx: number, profile: Profile): Promise<void> {
  for (;;) {
    const skill = skills[idx];
    if (skill.outcome.kind !== "skill") {
      p.note(ink.soft("This folder is not a skill."), skill.dirName);
      return;
    }
    const o = skill.outcome;
    const t = o.tokens;
    p.note(
      `${bandPaint[o.score.band](bold(`${o.score.value}/100 · ${o.score.band}`))}\n` +
        ink.soft(
          `tokens · metadata ${t.metadata} · body ${t.body} · references ${t.references} · scripts ${t.scriptFiles} · total ${t.total}`
        ),
      skill.dirName
    );

    const findings = orderedFindings(o.findings);
    if (!findings.length) {
      p.log.success(ink.bone("Clean — passes every enabled rule."));
      return;
    }

    const choice = await p.select({
      message: "Findings — pick one for details",
      maxItems: 12,
      options: [
        ...findings.map((f, i) => ({
          value: String(i),
          label: `${sevPaint[f.severity](sevMark[f.severity])} ${f.message}`,
          hint: `${f.ruleId}${f.line ? `:${f.line}` : ""}${f.fix ? " · fixable ⚒" : ""}`,
        })),
        { value: "back", label: ink.soft("← Back to the list") },
      ],
    });
    if (bail(choice) || choice === "back") return;

    const f = findings[Number(choice)];
    const loc = f.line ? ` (${f.file ?? "SKILL.md"}:${f.line})` : "";
    p.note(
      `${ink.soft("why")}  ${f.why}\n${ink.soft("fix")}  ${f.howToFix}`,
      `${sevPaint[f.severity](sevMark[f.severity])} ${f.message}${loc}`
    );

    if (f.fix) {
      const preview = previewFix(skill, f);
      if (!preview || !preview.changed.length) {
        p.log.warn("That fix produces no change.");
      } else {
        const ok = await p.confirm({ message: `Temper — write ${preview.changed.join(", ")} to disk?` });
        if (!bail(ok) && ok) {
          const s = p.spinner();
          s.start("Tempering");
          skills[idx] = commitFix(skill, preview, profile);
          s.stop(ink.ember(`Applied · ${preview.label}`));
        }
      }
    }
    // loop back to the (now possibly updated) findings list
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
  p.log.success(`Exported ${underline(path)}`);
}

export async function runInteractive(sources: SourceRef[], initialProfile: Profile): Promise<void> {
  process.stdout.write("\n" + blacksmith(ink.soft) + "\n");
  p.intro(`${ink.ember(bold("⚒ skillsmith"))} ${ink.soft("· agent-skill analyzer")}`);
  let profile = initialProfile;

  const source = await chooseSource(sources, profile);
  if (!source) return;

  const spin = p.spinner();
  spin.start(`Inspecting ${source.label}`);
  let skills = analyzeSource(source, profile);
  spin.stop(`${skills.length} skill${skills.length === 1 ? "" : "s"} · profile ${ink.ember(profile)}`);

  if (!skills.length) {
    p.outro(ink.soft("Nothing to analyze here."));
    return;
  }

  for (;;) {
    const choice = await p.select({
      message: "Inspect a skill",
      maxItems: 12,
      options: [
        ...skills.map((k, i) => ({ value: `skill:${i}`, label: skillLabel(k) })),
        { value: "profile", label: `${ink.soft("↻")} Switch profile ${ink.soft(`(now: ${profile})`)}` },
        { value: "export", label: `${ink.soft("⬇")} Export report` },
        { value: "quit", label: `${ink.soft("✖")} Quit` },
      ],
    });
    if (bail(choice) || choice === "quit") break;
    if (choice === "profile") {
      profile = profile === "generic" ? "claude-code-plugin" : "generic";
      skills = skills.map((k) => relint(k, profile));
      p.log.info(`Profile: ${ink.ember(profile)}`);
      continue;
    }
    if (choice === "export") {
      await exportFlow(skills, source, profile);
      continue;
    }
    await inspect(skills, Number((choice as string).split(":")[1]), profile);
  }
  p.outro(ink.ember("Forge better skills."));
}
