import type { Rule } from "../model";
import { mk } from "./util";
import { parseBody } from "../parser/markdown";

const CAP = 3;

const OR_RE = /\bor\b/gi;
const NUMBERED = /^\s*\d+\.\s/;
const VALIDATE = /\b(validate|verify|double-check)\b/i;
const TROUBLESHOOT_H = /troubleshoot|common (issues|mistakes|problems)/i;

function norm(t: string): string {
  return t.trim().toLowerCase().replace(/\s+/g, " ");
}

const s04: Rule = {
  id: "S04",
  severity: "suggestion",
  check(s) {
    if (s.body.headings.length !== 0 || s.body.lines.length <= 20) return [];
    return [
      mk("S04", "suggestion",
        "long body has no headings",
        "Headings give the agent a scannable structure and let it jump to the relevant section instead of reading everything.",
        "Break the body into ## sections such as Overview, Usage, and Examples."),
    ];
  },
};

const s08: Rule = {
  id: "S08",
  severity: "suggestion",
  check(s) {
    return s.body.proseLines
      .filter((l) => (l.text.match(OR_RE)?.length ?? 0) >= 3)
      .slice(0, CAP)
      .map((l) =>
        mk("S08", "suggestion",
          `Line ${l.line} lists many alternatives with "or"`,
          "A long chain of or-alternatives forces the agent to choose without a rule; it usually signals a missing decision criterion.",
          "State how to choose, or turn the options into a short table with when-to-use guidance.",
          { line: l.line })
      );
  },
};

const s09: Rule = {
  id: "S09",
  severity: "suggestion",
  check(s) {
    const steps = s.body.proseLines.filter((l) => NUMBERED.test(l.text)).length;
    const hasTs = s.body.headings.some((h) => TROUBLESHOOT_H.test(h.text));
    if (steps < 3 || hasTs) return [];
    return [
      mk("S09", "suggestion",
        "multi-step procedure has no troubleshooting section",
        "Step-by-step skills fail in predictable ways; without a troubleshooting section the agent has nowhere to recover from them.",
        "Add a Troubleshooting or Common Issues section covering the likely failure modes."),
    ];
  },
};

const s10: Rule = {
  id: "S10",
  severity: "suggestion",
  check(s) {
    const hits = s.body.proseLines.filter((l) => VALIDATE.test(l.text)).length;
    const hasScripts = s.files.some((f) => f.path.startsWith("scripts/"));
    if (hits < 2 || hasScripts) return [];
    return [
      mk("S10", "suggestion",
        "critical validation is described only in prose",
        "Prose validation is easy for the agent to skip or misjudge; a deterministic script enforces it every time.",
        "Move the checks into a script under scripts/ and reference it from the body."),
    ];
  },
};

const s13: Rule = {
  id: "S13",
  severity: "suggestion",
  check(s) {
    const bodySet = new Set(s.body.proseLines.map((l) => norm(l.text)).filter((t) => t.length > 60));
    const shared = new Set<string>();
    for (const f of s.files) {
      if (f.path === s.skillFile.path || !f.path.toLowerCase().endsWith(".md")) continue;
      for (const l of parseBody(f.content, 1).proseLines) {
        const n = norm(l.text);
        if (n.length > 60 && bodySet.has(n)) shared.add(n);
      }
    }
    if (shared.size < 3) return [];
    return [
      mk("S13", "suggestion",
        `${shared.size} long lines are duplicated between SKILL.md and reference files`,
        "Duplicated content drifts out of sync and wastes context — the reference and the body eventually disagree.",
        "Keep each fact in one place: summarize in SKILL.md and link to the reference for detail."),
    ];
  },
};

const s14: Rule = {
  id: "S14",
  severity: "suggestion",
  check(s) {
    const depth2 = s.body.headings.filter((h) => h.depth === 2).length;
    if (s.body.wordCount <= 3000 || depth2 < 8) return [];
    return [
      mk("S14", "suggestion",
        `possible mega-skill (${s.body.wordCount} words, ${depth2} top-level sections)`,
        "A large skill covering many unrelated capabilities triggers imprecisely and is hard to maintain.",
        "Consider splitting it into focused skills, one per capability."),
    ];
  },
};

export const suggestionBodyRules: Rule[] = [s04, s08, s09, s10, s13, s14];
