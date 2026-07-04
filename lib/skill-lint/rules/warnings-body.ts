import type { Finding, Rule, SkillFile } from "../model";
import { mk } from "./util";

const CAP = 5;

const YOU_IMPERATIVE = /\byou (should|need to|must|can)\b/i;
const BACKSLASH_PATH = /[A-Za-z0-9_.]+\\[A-Za-z0-9_.\\-]+/;
const BACKSLASH_PATH_G = /[A-Za-z0-9_.]+\\[A-Za-z0-9_.\\-]+/g;
const TIME_SENSITIVE = /\b(before|after|as of|since|until)\b[^.\n]{0,40}\b20\d{2}\b/i;
const MCP_MENTION = /\bMCP\b/i;
const BACKTICK_TOKEN = /`([^`]+)`/g;
const BARE_TOOL = /^[a-z][a-z0-9_-]*$/;
const VAGUE = /\b(properly|correctly|appropriately|as needed|if necessary)\b/i;
const CAPS_DIRECTIVE = /\b(MUST|NEVER|ALWAYS)\b/g;

const w01: Rule = {
  id: "W01",
  severity: "warning",
  check(s) {
    if (s.body.lines.length < 500 && s.body.wordCount < 5000) return [];
    return [
      mk("W01", "warning",
        `SKILL.md body is large (${s.body.lines.length} lines, ${s.body.wordCount} words)`,
        "The whole body loads into context whenever the skill triggers; large bodies spend budget the agent may not need for the task.",
        "Move detail into files under references/ and link to them, keeping SKILL.md a lean overview."),
    ];
  },
};

const w06: Rule = {
  id: "W06",
  severity: "warning",
  check(s) {
    const hits = s.body.proseLines.filter((l) => YOU_IMPERATIVE.test(l.text));
    if (hits.length === 0) return [];
    return [
      mk("W06", "warning",
        `Second-person instructions ("you should/need/must/can") on ${hits.length} line(s), first at line ${hits[0].line}`,
        "Skills read as stronger, shorter guidance when written as direct imperatives, per Anthropic's skill-authoring guidance.",
        'Rewrite as imperatives, e.g. "Run the tests" instead of "you should run the tests".',
        { line: hits[0].line }),
    ];
  },
};

function looksLikePath(m: string): boolean {
  const backslashCount = (m.match(/\\/g) || []).length;
  return /\.[A-Za-z0-9]{1,5}(\b|$)/.test(m) || backslashCount >= 2;
}

const w08: Rule = {
  id: "W08",
  severity: "warning",
  check(s) {
    const skillPath = s.skillFile.path;
    const flagged = s.body.proseLines.filter((l) => BACKSLASH_PATH.test(l.text)).slice(0, CAP);
    if (flagged.length === 0) return [];
    const flaggedLineNumbers = flagged.map((l) => l.line);
    const fix = {
      label: "Convert backslash paths to forward slashes",
      apply(files: SkillFile[]): SkillFile[] {
        return files.map((f) => {
          if (f.path !== skillPath) return f;
          const lines = f.content.split("\n");
          for (const lineNo of flaggedLineNumbers) {
            const idx = lineNo - 1;
            if (idx < 0 || idx >= lines.length) continue;
            lines[idx] = lines[idx].replace(BACKSLASH_PATH_G, (m) =>
              looksLikePath(m) ? m.replace(/\\/g, "/") : m
            );
          }
          return { ...f, content: lines.join("\n") };
        });
      },
    };
    return flagged.map((l) =>
      mk("W08", "warning",
        `Windows-style backslash path on line ${l.line}`,
        "Backslash paths break on macOS and Linux where Claude Code runs; paths must use forward slashes.",
        "Use forward slashes, e.g. references/api.md.",
        { line: l.line, fix })
    );
  },
};

const w09: Rule = {
  id: "W09",
  severity: "warning",
  check(s) {
    return s.body.proseLines
      .filter((l) => TIME_SENSITIVE.test(l.text))
      .slice(0, CAP)
      .map((l) =>
        mk("W09", "warning",
          `Time-sensitive statement on line ${l.line}`,
          'Dated claims ("before August 2025", "as of 2024") go stale and mislead the agent once the date passes.',
          "State the condition without a date, or move volatile facts into a reference the user can update.",
          { line: l.line })
      );
  },
};

const w16: Rule = {
  id: "W16",
  severity: "warning",
  check(s) {
    const out: Finding[] = [];
    for (const l of s.body.proseLines) {
      if (out.length >= 3) break;
      if (!MCP_MENTION.test(l.text)) continue;
      let bare = false;
      for (const m of l.text.matchAll(BACKTICK_TOKEN)) {
        const tok = m[1];
        if (BARE_TOOL.test(tok) && !tok.includes("__") && !tok.includes(":")) {
          bare = true;
          break;
        }
      }
      if (bare) {
        out.push(
          mk("W16", "warning",
            `Unqualified MCP tool name on line ${l.line}`,
            "MCP tools are addressed as ServerName:tool_name; a bare tool name is ambiguous once more than one server is connected.",
            "Qualify the tool with its server, e.g. `Brave:search` instead of `search`.",
            { line: l.line })
        );
      }
    }
    return out;
  },
};

const w20: Rule = {
  id: "W20",
  severity: "warning",
  check(s) {
    const hits = s.body.proseLines.filter((l) => VAGUE.test(l.text));
    if (hits.length < 2) return [];
    return [
      mk("W20", "warning",
        `Vague qualifiers ("properly", "correctly", …) on ${hits.length} lines, first at line ${hits[0].line}`,
        'Words like "properly" tell the agent nothing measurable; they read as instructions but carry no criterion.',
        "Replace with the concrete criterion, e.g. \"until the tests pass\" instead of \"correctly\".",
        { line: hits[0].line }),
    ];
  },
};

const w21: Rule = {
  id: "W21",
  severity: "warning",
  check(s) {
    let count = 0;
    for (const l of s.body.proseLines) {
      const m = l.text.match(CAPS_DIRECTIVE);
      if (m) count += m.length;
    }
    if (count < 5) return [];
    return [
      mk("W21", "warning",
        `${count} all-caps MUST/NEVER/ALWAYS directives`,
        "Anthropic's guidance flags heavy all-caps imperatives as a rigidity anti-pattern — they crowd out reasoning and rarely improve compliance.",
        "Keep a few genuine hard rules; express the rest as normal prose with the reason it matters."),
    ];
  },
};

export const warningBodyRules: Rule[] = [w01, w06, w08, w09, w16, w20, w21];
