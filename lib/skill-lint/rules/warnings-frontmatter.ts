import type { Finding, Rule } from "../model";
import { mk } from "./util";

export const GENERIC_ALLOWED_KEYS = [
  "name", "description", "license", "allowed-tools", "metadata", "compatibility",
];
export const PLUGIN_ALLOWED_KEYS = [
  ...GENERIC_ALLOWED_KEYS,
  "version", "disable-model-invocation", "user-invokable", "argument-hint",
];

const CAP = 5;

const w12: Rule = {
  id: "W12",
  severity: "warning",
  check(s, ctx) {
    const allowed = new Set(ctx.profile === "claude-code-plugin" ? PLUGIN_ALLOWED_KEYS : GENERIC_ALLOWED_KEYS);
    const out: Finding[] = [];
    for (const key of Object.keys(s.frontmatter.data)) {
      if (out.length >= CAP) break;
      const lk = key.toLowerCase();
      if (lk === "when_to_use") continue; // W13 owns this
      if (!allowed.has(lk)) {
        out.push(
          mk("W12", "warning",
            `Unknown frontmatter field: "${key}"`,
            "Unrecognized fields are ignored by the loader and usually indicate a typo in a real field name.",
            `Remove "${key}" or correct it to a supported field (${[...allowed].join(", ")}).`)
        );
      }
    }
    return out;
  },
};

const w13: Rule = {
  id: "W13",
  severity: "warning",
  check(s) {
    const occ = s.frontmatter.keyOccurrences.find((k) => k.key.toLowerCase() === "when_to_use");
    if (!occ) return [];
    return [
      mk("W13", "warning",
        'Deprecated frontmatter field "when_to_use"',
        "when_to_use is an old convention; current skills fold triggering guidance into the description field.",
        "Delete when_to_use and make sure the description states when to use the skill.",
        { line: occ.line }),
    ];
  },
};

const w14: Rule = {
  id: "W14",
  severity: "warning",
  profiles: ["claude-code-plugin"],
  check(s) {
    const occ = s.frontmatter.keyOccurrences.find((k) => k.key.toLowerCase() === "allowed-tools");
    if (!occ) return [];
    return [
      mk("W14", "warning",
        '"allowed-tools" is not a valid skill frontmatter field in Claude Code',
        "In the Claude Code plugin format, tool permissions are configured elsewhere; allowed-tools in SKILL.md is silently ignored.",
        "Remove allowed-tools from the frontmatter and configure tool access through the plugin settings.",
        { line: occ.line }),
    ];
  },
};

const w15: Rule = {
  id: "W15",
  severity: "warning",
  check(s) {
    const counts = new Map<string, { n: number; line: number }>();
    for (const k of s.frontmatter.keyOccurrences) {
      const lk = k.key.toLowerCase();
      const prev = counts.get(lk);
      counts.set(lk, { n: (prev?.n ?? 0) + 1, line: prev?.line ?? k.line });
    }
    const out: Finding[] = [];
    for (const [lk, info] of counts) {
      if (lk === "description") continue; // E05 owns duplicate description
      if (info.n > 1) {
        out.push(
          mk("W15", "warning",
            `Frontmatter key "${lk}" appears ${info.n} times (duplicate or mixed case)`,
            "Duplicate keys are invalid YAML; loaders keep only one value and silently drop the rest.",
            `Keep a single "${lk}" entry with the correct casing.`,
            { line: info.line })
        );
      }
    }
    return out;
  },
};

export const warningFrontmatterRules: Rule[] = [w12, w13, w14, w15];
