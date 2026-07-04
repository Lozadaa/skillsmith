# Skillsmith Plan 2: Rule Catalog Completion (`W01–W21` + `S01–S15`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the Skillsmith lint catalog by adding the 21 warning rules (`W01`–`W21`) and 15 suggestion rules (`S01`–`S15`) on top of Plan 1's engine and error rules (`E01`–`E12`). Each rule is a pure `(skill, ctx) => Finding[]` function, packaged into rule packs, and wired into `allRules`.

**Architecture:** New rule packs live under `lib/skill-lint/rules/` alongside the existing `errors-frontmatter.ts` / `errors-structure.ts`. They reuse the Plan 1 primitives: `Rule`/`Finding`/`ParsedSkill` from `model.ts`, the `mk()` factory from `rules/util.ts`, the tolerant `parseBody()` from `parser/markdown.ts`, and `looksLikeSymlink()` from `parser/skill.ts`. Rules are appended to the `allRules` array literal in `index.ts` and filtered by profile in the existing engine. Spec: `docs/specs/2026-07-04-skillsmith-design.md` §5.

**Tech Stack:** Pure TypeScript (strict) under `lib/skill-lint/`, tested with Vitest 3. No React/Next imports. Node 20+, npm.

**Roadmap context:** This is Plan 2 of 5. Plan 1 = core engine + `E01`–`E12` (done). Plan 3 = workspace UI + export; Plan 4 = wizard; Plan 5 = GitHub importer.

## Global Constraints

- Pure TS under `lib/skill-lint/` — no React, Next.js, or any UI import. Only `../model`, sibling rule/parser modules, and `yaml` (transitively via the parser) are allowed.
- Every `Finding` carries non-empty `message` (what), `why` (why it matters, citing best practice), and `howToFix` — never an empty string. Build every finding through `mk()`.
- Rules must NEVER throw. The engine isolates crashes into a synthetic finding, but do not rely on it: guard every frontmatter value with a `typeof`/`str()` check before using it (values may be `undefined`, numbers, arrays, or objects), and never index into a possibly-`undefined` object.
- **Bounded findings:** any rule that can fire per line/per file MUST cap its output at **5 findings per rule per skill** (some rules use a tighter cap of 3, called out per rule). This prevents a single pathological file from flooding the report. Use `.slice(0, CAP)` or an early `break`.
- New rule packs are appended to `allRules` in `lib/skill-lint/index.ts` by **extending the array literal** (`export const allRules: Rule[] = [ ...frontmatterErrorRules, ..., ...suggestionFileRules ]`). Never `push()` onto it at runtime.
- Rule IDs are exact and stable: `W01`–`W21`, `S01`–`S15`. Warning rules use `severity: "warning"`; suggestion rules use `severity: "suggestion"`.
- Only `W14` is profile-scoped (`profiles: ["claude-code-plugin"]`). `W12` reads `ctx.profile` to pick its allowlist. All other rules apply to every profile.
- Tests use the Plan 1 helper pattern: build fixtures via `parseSkill(...)`, then run the pack through `runRules(...)` and map to `ruleId`s (`idsFor`). Run all commands from repo root `C:\Users\richa\projects\skillsmith`.

---

### Task 1: Description warning rules (`W02`, `W03`, `W04`, `W05`, `W07`)

**Files:**
- Create: `lib/skill-lint/rules/warnings-description.ts`
- Test: `lib/skill-lint/rules/warnings-description.test.ts`

**Interfaces:**
- Consumes: `mk` (`./util`), model types, `parseSkill` (in tests), `runRules` (in tests)
- Produces: `export const warningDescriptionRules: Rule[];` with ids `W02`, `W03`, `W04`, `W05`, `W07`

Rule semantics (spec §5):
- `W02`: `description` (string, non-empty) trimmed length `< 20` → one finding.
- `W03`: `description` length `501..1024` inclusive → one finding (soft ceiling; `E05` owns `> 1024`).
- `W04`: `description` matches first/second person regex → one finding.
- `W05`: `description` does NOT contain a trigger marker → one finding.
- `W07`: any kebab segment of `name` is in the generic-name blocklist → one finding.

`W02`/`W03`/`W04`/`W05` only fire when `description` is a non-empty string (missing/empty/non-string is owned by `E05`). `W07` only fires when `name` is a string.

- [ ] **Step 1: Write the failing tests**

`lib/skill-lint/rules/warnings-description.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { warningDescriptionRules } from "./warnings-description";
import { runRules } from "./engine";
import { parseSkill } from "../parser/skill";
import type { ParsedSkill } from "../model";

function build(fm: string): ParsedSkill {
  const r = parseSkill([{ path: "SKILL.md", content: `---\n${fm}\n---\nBody` }]);
  if (r.kind !== "skill") throw new Error("fixture is not a skill: " + r.reason);
  return r.skill;
}

function idsFor(fm: string): string[] {
  return runRules(build(fm), warningDescriptionRules, { profile: "generic" }).map((f) => f.ruleId);
}

describe("W02 description too short", () => {
  it("fires when a present description is under 20 chars", () => {
    expect(idsFor("name: a-b\ndescription: too short")).toContain("W02");
  });
  it("does not fire at 20+ chars", () => {
    expect(idsFor("name: a-b\ndescription: Use when the length is comfortably long")).not.toContain("W02");
  });
  it("does not fire when description is absent (E05 owns that)", () => {
    expect(idsFor("name: a-b")).not.toContain("W02");
  });
});

describe("W03 description soft ceiling", () => {
  it("fires between 501 and 1024 chars", () => {
    expect(idsFor(`name: a-b\ndescription: ${"x".repeat(600)}`)).toContain("W03");
  });
  it("does not fire at exactly 500 chars", () => {
    expect(idsFor(`name: a-b\ndescription: ${"x".repeat(500)}`)).not.toContain("W03");
  });
  it("does not fire above 1024 (E05 owns that)", () => {
    expect(idsFor(`name: a-b\ndescription: ${"x".repeat(1100)}`)).not.toContain("W03");
  });
});

describe("W04 first/second person", () => {
  it("fires on first/second person phrasing", () => {
    expect(idsFor("name: a-b\ndescription: You should use this to review code when needed")).toContain("W04");
    expect(idsFor("name: a-b\ndescription: I can help you when working on PDFs")).toContain("W04");
  });
  it("does not fire on capability + trigger phrasing", () => {
    expect(idsFor("name: a-b\ndescription: Use when reviewing pull requests for security issues")).not.toContain("W04");
  });
});

describe("W05 missing trigger marker", () => {
  it("fires when no trigger marker is present", () => {
    expect(idsFor("name: a-b\ndescription: Reviews pull requests for security issues")).toContain("W05");
  });
  it("does not fire when a trigger marker is present", () => {
    expect(idsFor("name: a-b\ndescription: Use when reviewing pull requests")).not.toContain("W05");
    expect(idsFor("name: a-b\ndescription: Reviews PRs. Triggers: security review")).not.toContain("W05");
  });
});

describe("W07 generic name segment", () => {
  it("fires when a kebab segment is a generic word", () => {
    expect(idsFor("name: data-helper\ndescription: Use when testing the linter")).toContain("W07");
    expect(idsFor("name: pdf-utils\ndescription: Use when testing the linter")).toContain("W07");
  });
  it("does not fire on a descriptive name", () => {
    expect(idsFor("name: processing-pdfs\ndescription: Use when testing the linter")).not.toContain("W07");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/skill-lint/rules/warnings-description.test.ts`
Expected: FAIL — "Cannot find module './warnings-description'".

- [ ] **Step 3: Implement warnings-description.ts**

```ts
import type { Rule } from "../model";
import { mk } from "./util";

const FIRST_SECOND_PERSON = /\b(I can|I will|I'll|you can|you should|you need|use this skill when you)\b/i;
const TRIGGER_MARKER = /use when|when the user|when working|when you need|triggers?:/i;
const GENERIC_NAME_SEGMENTS = new Set([
  "helper", "helpers", "util", "utils", "tool", "tools", "data", "files", "documents", "misc", "stuff",
]);

function str(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

/** Returns the description only when it is a non-empty string (missing/empty is E05's job). */
function descOf(data: Record<string, unknown>): string | undefined {
  const d = str(data["description"]);
  return d !== undefined && d.trim().length > 0 ? d : undefined;
}

const w02: Rule = {
  id: "W02",
  severity: "warning",
  check(s) {
    const desc = descOf(s.frontmatter.data);
    if (desc === undefined || desc.trim().length >= 20) return [];
    return [
      mk("W02", "warning",
        `description is only ${desc.trim().length} characters`,
        "A description under 20 characters cannot express both what the skill does and when to use it, so Claude rarely triggers it.",
        'Expand it to name the capability and its triggers, e.g. "Use when reviewing pull requests for security issues".'),
    ];
  },
};

const w03: Rule = {
  id: "W03",
  severity: "warning",
  check(s) {
    const desc = descOf(s.frontmatter.data);
    if (desc === undefined || desc.length < 501 || desc.length > 1024) return [];
    return [
      mk("W03", "warning",
        `description is ${desc.length} characters (soft limit 500)`,
        "The spec allows up to 1024 chars, but descriptions are loaded into every conversation; long ones bloat the system prompt and dilute the trigger signal.",
        "Trim to ~500 characters — keep what it does and when to use it, move detail into the body."),
    ];
  },
};

const w04: Rule = {
  id: "W04",
  severity: "warning",
  check(s) {
    const desc = descOf(s.frontmatter.data);
    if (desc === undefined || !FIRST_SECOND_PERSON.test(desc)) return [];
    return [
      mk("W04", "warning",
        "description uses first/second person phrasing",
        'Descriptions read best as third-person capability statements; "I can" / "you should" phrasing weakens the trigger and wastes characters.',
        'Rewrite in third person, e.g. "Reviews pull requests…" or "Use when reviewing…".'),
    ];
  },
};

const w05: Rule = {
  id: "W05",
  severity: "warning",
  check(s) {
    const desc = descOf(s.frontmatter.data);
    if (desc === undefined || TRIGGER_MARKER.test(desc)) return [];
    return [
      mk("W05", "warning",
        "description has no explicit trigger marker",
        "Claude decides whether to load a skill from its description; without a clear trigger phrase it is often missed.",
        'Add an explicit trigger, e.g. "Use when …", "when the user …", or "Triggers: …".'),
    ];
  },
};

const w07: Rule = {
  id: "W07",
  severity: "warning",
  check(s) {
    const name = str(s.frontmatter.data["name"]);
    if (name === undefined) return [];
    const offending = name.toLowerCase().split("-").find((seg) => GENERIC_NAME_SEGMENTS.has(seg));
    if (!offending) return [];
    return [
      mk("W07", "warning",
        `name contains the generic word "${offending}"`,
        "Generic names like helper/utils/tools describe nothing; they collide with other skills and never match how users phrase requests.",
        "Rename around the concrete capability, e.g. processing-pdfs instead of pdf-tools."),
    ];
  },
};

export const warningDescriptionRules: Rule[] = [w02, w03, w04, w05, w07];
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/skill-lint/rules/warnings-description.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add lib/skill-lint/rules/warnings-description.ts lib/skill-lint/rules/warnings-description.test.ts
git commit -m "feat(engine): description warning rules W02-W05, W07"
```

---

### Task 2: Body warning rules (`W01`, `W06`, `W08`+autofix, `W09`, `W16`, `W20`, `W21`)

**Files:**
- Create: `lib/skill-lint/rules/warnings-body.ts`
- Test: `lib/skill-lint/rules/warnings-body.test.ts`

**Interfaces:**
- Consumes: `mk`, model types (incl. `SkillFile`, `AutoFix`), `parseSkill` (in tests)
- Produces: `export const warningBodyRules: Rule[];` with ids `W01`, `W06`, `W08`, `W09`, `W16`, `W20`, `W21`

Rule semantics (spec §5):
- `W01`: `body.lines.length >= 500` OR `body.wordCount >= 5000` → one finding.
- `W06`: prose lines matching `/\byou (should|need to|must|can)\b/i` → one finding citing first line + total count (only if `>= 1`).
- `W08`: prose line matching the backslash-path regex → one finding per line (cap 5), each carrying an `AutoFix` that converts backslashes to forward slashes in `SKILL.md`.
- `W09`: prose line matching the time-sensitive regex → one finding per line (cap 5).
- `W16`: prose line containing `MCP` AND a bare backtick tool token → one finding per line (cap 3).
- `W20`: prose lines matching the vague-qualifier regex → ONE finding with count + first line, only if count `>= 2`.
- `W21`: count of all-caps `MUST`/`NEVER`/`ALWAYS` tokens across prose `>= 5` → one finding.

- [ ] **Step 1: Write the failing tests**

`lib/skill-lint/rules/warnings-body.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { warningBodyRules } from "./warnings-body";
import { runRules } from "./engine";
import { parseSkill } from "../parser/skill";
import type { ParsedSkill, SkillFile } from "../model";

function build(body: string): ParsedSkill {
  const r = parseSkill([{ path: "SKILL.md", content: `---\nname: a-b\ndescription: Use when testing the body rules\n---\n${body}` }]);
  if (r.kind !== "skill") throw new Error("fixture is not a skill: " + r.reason);
  return r.skill;
}

function findings(body: string) {
  return runRules(build(body), warningBodyRules, { profile: "generic" });
}
function idsFor(body: string): string[] {
  return findings(body).map((f) => f.ruleId);
}

describe("W01 oversized body", () => {
  it("fires at 500+ lines", () => {
    expect(idsFor(Array.from({ length: 500 }, () => "line").join("\n"))).toContain("W01");
  });
  it("does not fire on a small body", () => {
    expect(idsFor("# Title\nShort body.")).not.toContain("W01");
  });
});

describe("W06 second-person body", () => {
  it("fires once and reports the first line", () => {
    const out = findings("Intro.\nyou should run the tests.\nyou must commit.").filter((f) => f.ruleId === "W06");
    expect(out).toHaveLength(1);
    expect(out[0].message).toContain("2");
  });
  it("does not fire on imperative prose", () => {
    expect(idsFor("Run the tests. Commit the result.")).not.toContain("W06");
  });
});

describe("W08 backslash paths with autofix", () => {
  it("fires per line (capped) and the fix rewrites backslashes", () => {
    const files: SkillFile[] = [
      { path: "SKILL.md", content: `---\nname: a-b\ndescription: Use when testing the body rules\n---\nSee references\\api.md now` },
    ];
    const r = parseSkill(files);
    if (r.kind !== "skill") throw new Error(r.reason);
    const out = runRules(r.skill, warningBodyRules, { profile: "generic" }).filter((f) => f.ruleId === "W08");
    expect(out).toHaveLength(1);
    expect(out[0].fix).toBeDefined();
    const fixed = out[0].fix!.apply(files);
    expect(fixed[0].content).toContain("references/api.md");
    expect(fixed[0].content).not.toContain("references\\api.md");
  });
  it("caps at 5 findings", () => {
    const lines = Array.from({ length: 8 }, (_, i) => `path a${i}\\b${i}.md`).join("\n");
    expect(findings(lines).filter((f) => f.ruleId === "W08")).toHaveLength(5);
  });
  it("does not fire on forward-slash paths", () => {
    expect(idsFor("See references/api.md")).not.toContain("W08");
  });
});

describe("W09 time-sensitive info", () => {
  it("fires on a dated reference", () => {
    expect(idsFor("This changed before August 2025 in the API.")).toContain("W09");
  });
  it("does not fire without a nearby year", () => {
    expect(idsFor("Run this before the tests.")).not.toContain("W09");
  });
});

describe("W16 unqualified MCP tool", () => {
  it("fires when MCP is mentioned with a bare backtick tool", () => {
    expect(idsFor("Call the MCP tool `search` to query.")).toContain("W16");
  });
  it("does not fire when the tool is qualified", () => {
    expect(idsFor("Call the MCP tool `Brave:search` to query.")).not.toContain("W16");
  });
});

describe("W20 vague qualifiers", () => {
  it("fires only when 2+ lines are vague", () => {
    expect(idsFor("Handle it properly.\nValidate correctly.")).toContain("W20");
  });
  it("does not fire on a single vague line", () => {
    expect(idsFor("Handle it properly.")).not.toContain("W20");
  });
});

describe("W21 caps directive density", () => {
  it("fires at 5+ MUST/NEVER/ALWAYS", () => {
    expect(idsFor("MUST do this. NEVER that. ALWAYS this. MUST here. NEVER there.")).toContain("W21");
  });
  it("does not fire below the threshold", () => {
    expect(idsFor("MUST do this. Never lowercase counts differently.")).not.toContain("W21");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/skill-lint/rules/warnings-body.test.ts`
Expected: FAIL — "Cannot find module './warnings-body'".

- [ ] **Step 3: Implement warnings-body.ts**

```ts
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

const w08: Rule = {
  id: "W08",
  severity: "warning",
  check(s) {
    const skillPath = s.skillFile.path;
    const fix = {
      label: "Convert backslash paths to forward slashes",
      apply(files: SkillFile[]): SkillFile[] {
        return files.map((f) =>
          f.path === skillPath
            ? { ...f, content: f.content.replace(BACKSLASH_PATH_G, (m) => m.replace(/\\/g, "/")) }
            : f
        );
      },
    };
    return s.body.proseLines
      .filter((l) => BACKSLASH_PATH.test(l.text))
      .slice(0, CAP)
      .map((l) =>
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
          "Dated claims ("before August 2025", "as of 2024") go stale and mislead the agent once the date passes.",
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/skill-lint/rules/warnings-body.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add lib/skill-lint/rules/warnings-body.ts lib/skill-lint/rules/warnings-body.test.ts
git commit -m "feat(engine): body warning rules W01,W06,W08-W09,W16,W20-W21 with backslash autofix"
```

---

### Task 3: Structure warning rules (`W10`, `W11`, `W17`, `W18`, `W19`)

**Files:**
- Create: `lib/skill-lint/rules/warnings-structure.ts`
- Test: `lib/skill-lint/rules/warnings-structure.test.ts`

**Interfaces:**
- Consumes: `mk`, model types, `parseBody` (`../parser/markdown`), `looksLikeSymlink` (`../parser/skill`), `parseSkill` (in tests)
- Produces: `export const warningStructureRules: Rule[];` with ids `W10`, `W11`, `W17`, `W18`, `W19`

Rule semantics (spec §5):
- `W10`: for each non-SKILL `.md` file, `parseBody(content, 1)`; if any relative `.md` link resolves (relative to that file's own directory) to another existing file in the skill → one finding for that reference (cap 5).
- `W11`: each non-SKILL `.md` file whose path is not among SKILL.md's normalized body link targets → one finding per orphan (cap 5).
- `W17`: each file where `looksLikeSymlink(f)` is true → one portability finding per file (cap 5).
- `W18`: each file whose path contains `__pycache__/`, `node_modules`, `.DS_Store`, or ends `.pyc` → one finding per file (cap 5).
- `W19`: each file whose content matches a secret pattern → one finding per file+pattern (cap 5 total across the rule).

- [ ] **Step 1: Write the failing tests**

`lib/skill-lint/rules/warnings-structure.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { warningStructureRules } from "./warnings-structure";
import { runRules } from "./engine";
import { parseSkill } from "../parser/skill";
import type { SkillFile } from "../model";

function idsFor(files: SkillFile[]): string[] {
  const r = parseSkill(files);
  if (r.kind !== "skill") throw new Error("fixture is not a skill: " + r.reason);
  return runRules(r.skill, warningStructureRules, { profile: "generic" }).map((f) => f.ruleId);
}

const SKILL = (body: string): SkillFile => ({
  path: "SKILL.md",
  content: `---\nname: a-b\ndescription: Use when testing structure rules\n---\n${body}`,
});

describe("W10 references deeper than one level", () => {
  it("fires when a reference links to another skill file", () => {
    expect(
      idsFor([
        SKILL("See [a](references/a.md)"),
        { path: "references/a.md", content: "See [b](b.md)" },
        { path: "references/b.md", content: "leaf" },
      ])
    ).toContain("W10");
  });
  it("does not fire when references are leaves", () => {
    expect(
      idsFor([SKILL("See [a](references/a.md)"), { path: "references/a.md", content: "no links here" }])
    ).not.toContain("W10");
  });
});

describe("W11 orphan reference files", () => {
  it("fires on an unlinked .md file", () => {
    expect(idsFor([SKILL("No links at all"), { path: "references/orphan.md", content: "x" }])).toContain("W11");
  });
  it("does not fire when the file is linked", () => {
    expect(
      idsFor([SKILL("See [a](references/a.md)"), { path: "references/a.md", content: "x" }])
    ).not.toContain("W11");
  });
});

describe("W17 symlink portability", () => {
  it("fires on a symlink-flagged file", () => {
    expect(idsFor([SKILL("body"), { path: "references/a.md", content: "../shared/a.md", symlink: true }])).toContain("W17");
  });
  it("does not fire on a normal file", () => {
    expect(idsFor([SKILL("body"), { path: "references/a.md", content: "# Real content\nwith prose" }])).not.toContain("W17");
  });
});

describe("W18 packaging junk", () => {
  it("fires on junk paths", () => {
    expect(idsFor([SKILL("body"), { path: "scripts/__pycache__/x.pyc", content: "" }])).toContain("W18");
    expect(idsFor([SKILL("body"), { path: ".DS_Store", content: "" }])).toContain("W18");
  });
  it("does not fire on clean paths", () => {
    expect(idsFor([SKILL("body"), { path: "scripts/run.py", content: "print(1)" }])).not.toContain("W18");
  });
});

describe("W19 apparent secrets", () => {
  it("fires on an AWS-style key", () => {
    expect(idsFor([SKILL("body"), { path: "scripts/cfg.txt", content: "key AKIAIOSFODNN7EXAMPLE here" }])).toContain("W19");
  });
  it("fires on an inline api_key assignment", () => {
    expect(idsFor([SKILL('api_key = "abcdef0123456789ABCDEF"')])).toContain("W19");
  });
  it("does not fire on clean content", () => {
    expect(idsFor([SKILL("Nothing secret here.")])).not.toContain("W19");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/skill-lint/rules/warnings-structure.test.ts`
Expected: FAIL — "Cannot find module './warnings-structure'".

- [ ] **Step 3: Implement warnings-structure.ts**

```ts
import type { Finding, ParsedSkill, Rule, SkillFile } from "../model";
import { mk } from "./util";
import { parseBody } from "../parser/markdown";
import { looksLikeSymlink } from "../parser/skill";

const CAP = 5;

const SECRET_PATTERNS: { name: string; re: RegExp }[] = [
  { name: "Anthropic API key", re: /sk-ant-[A-Za-z0-9-]{10,}/ },
  { name: "AWS access key id", re: /AKIA[0-9A-Z]{16}/ },
  { name: "GitHub token", re: /ghp_[A-Za-z0-9]{36}/ },
  { name: "Google API key", re: /AIza[0-9A-Za-z_-]{35}/ },
  { name: "private key block", re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: "inline api key", re: /\bapi[_-]?key\s*[:=]\s*["'][A-Za-z0-9_\-]{16,}["']/i },
];

function isRelative(t: string): boolean {
  return !/^(https?:|mailto:|#|\/)/.test(t);
}

function dirOf(path: string): string {
  const i = path.lastIndexOf("/");
  return i === -1 ? "" : path.slice(0, i);
}

/** Resolve a relative link target against a base directory, collapsing ./ and ../ */
function resolveRelative(fromDir: string, target: string): string {
  const clean = target.replace(/^\.\//, "").split("#")[0];
  const parts = fromDir === "" ? [] : fromDir.split("/");
  for (const seg of clean.split("/")) {
    if (seg === "..") parts.pop();
    else if (seg === "" || seg === ".") continue;
    else parts.push(seg);
  }
  return parts.join("/");
}

function normalizeTarget(t: string): string {
  return t.replace(/^\.\//, "").split("#")[0];
}

function nonSkillMd(s: ParsedSkill): SkillFile[] {
  return s.files.filter((f) => f.path !== s.skillFile.path && f.path.toLowerCase().endsWith(".md"));
}

function isJunk(p: string): boolean {
  return p.includes("__pycache__/") || p.includes("node_modules") || p.includes(".DS_Store") || p.endsWith(".pyc");
}

const w10: Rule = {
  id: "W10",
  severity: "warning",
  check(s) {
    const paths = new Set(s.files.map((f) => f.path));
    const out: Finding[] = [];
    for (const f of nonSkillMd(s)) {
      if (out.length >= CAP) break;
      const body = parseBody(f.content, 1);
      const deep = body.links.find((link) => {
        if (!isRelative(link.target)) return false;
        if (!normalizeTarget(link.target).toLowerCase().endsWith(".md")) return false;
        const resolved = resolveRelative(dirOf(f.path), link.target);
        return resolved !== "" && resolved !== f.path && paths.has(resolved);
      });
      if (deep) {
        out.push(
          mk("W10", "warning",
            `Reference "${f.path}" links to another skill file ("${deep.target}")`,
            "Progressive disclosure works best one level deep; references that point to further references make the load path hard to follow.",
            "Flatten the structure so SKILL.md links to each reference directly.",
            { file: f.path, line: deep.line })
        );
      }
    }
    return out;
  },
};

const w11: Rule = {
  id: "W11",
  severity: "warning",
  check(s) {
    const linked = new Set(
      s.body.links.filter((l) => isRelative(l.target)).map((l) => normalizeTarget(l.target))
    );
    return nonSkillMd(s)
      .filter((f) => !linked.has(f.path))
      .slice(0, CAP)
      .map((f) =>
        mk("W11", "warning",
          `"${f.path}" is never linked from SKILL.md`,
          "An orphan reference file is invisible to Claude — nothing points to it, so it is never read.",
          `Link it from SKILL.md (e.g. [${f.path}](${f.path})) or remove it.`,
          { file: f.path })
      );
  },
};

const w17: Rule = {
  id: "W17",
  severity: "warning",
  check(s) {
    return s.files
      .filter((f) => looksLikeSymlink(f))
      .slice(0, CAP)
      .map((f) =>
        mk("W17", "warning",
          `"${f.path}" looks like a symlink`,
          "Symlinks do not survive zip packaging or Windows checkouts, so a symlinked skill silently breaks when distributed.",
          "Replace the symlink with the real file contents before packaging.",
          { file: f.path })
      );
  },
};

const w18: Rule = {
  id: "W18",
  severity: "warning",
  check(s) {
    return s.files
      .filter((f) => isJunk(f.path))
      .slice(0, CAP)
      .map((f) =>
        mk("W18", "warning",
          `Packaging junk in the skill: "${f.path}"`,
          "Build artifacts (__pycache__, node_modules, .DS_Store, *.pyc) bloat the package and can leak local machine state.",
          "Delete it and add the pattern to .gitignore so it stays out of the skill folder.",
          { file: f.path })
      );
  },
};

const w19: Rule = {
  id: "W19",
  severity: "warning",
  check(s) {
    const out: Finding[] = [];
    for (const f of s.files) {
      for (const p of SECRET_PATTERNS) {
        if (out.length >= CAP) return out;
        if (p.re.test(f.content)) {
          out.push(
            mk("W19", "warning",
              `Possible ${p.name} in "${f.path}"`,
              "A committed secret in a shared skill leaks credentials to everyone who installs it.",
              "Remove the secret, rotate it immediately, and load credentials from the environment at runtime.",
              { file: f.path })
          );
        }
      }
    }
    return out;
  },
};

export const warningStructureRules: Rule[] = [w10, w11, w17, w18, w19];
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/skill-lint/rules/warnings-structure.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add lib/skill-lint/rules/warnings-structure.ts lib/skill-lint/rules/warnings-structure.test.ts
git commit -m "feat(engine): structure warning rules W10-W11, W17-W19"
```

---

### Task 4: Frontmatter warning rules (`W12`, `W13`, `W14`, `W15`)

**Files:**
- Create: `lib/skill-lint/rules/warnings-frontmatter.ts`
- Test: `lib/skill-lint/rules/warnings-frontmatter.test.ts`

**Interfaces:**
- Consumes: `mk`, model types, `parseSkill` (in tests)
- Produces: `export const warningFrontmatterRules: Rule[];` with ids `W12`, `W13`, `W14`, `W15`, plus exported allowlist consts `GENERIC_ALLOWED_KEYS` and `PLUGIN_ALLOWED_KEYS`.

Rule semantics (spec §5):
- `W12`: for each frontmatter key whose lowercase form is not in the profile's allowlist (and is not `when_to_use`, owned by `W13`) → one finding per unknown key (cap 5). Generic allowlist: `name, description, license, allowed-tools, metadata, compatibility`. Plugin allowlist = generic + `version, disable-model-invocation, user-invokable, argument-hint`. (`allowed-tools` stays in the plugin allowlist so `W14` — not `W12` — flags it.)
- `W13`: a `when_to_use` key (any case) present → one finding (deprecated field).
- `W14`: PROFILE-SCOPED (`profiles: ["claude-code-plugin"]`) — an `allowed-tools` key present → one finding.
- `W15`: keys grouped by lowercase form with more than one occurrence, EXCLUDING `description` (owned by `E05`) → one finding per group.

- [ ] **Step 1: Write the failing tests**

`lib/skill-lint/rules/warnings-frontmatter.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { warningFrontmatterRules, GENERIC_ALLOWED_KEYS, PLUGIN_ALLOWED_KEYS } from "./warnings-frontmatter";
import { runRules } from "./engine";
import { parseSkill } from "../parser/skill";
import type { ParsedSkill, Profile } from "../model";

function build(fm: string): ParsedSkill {
  const r = parseSkill([{ path: "SKILL.md", content: `---\n${fm}\n---\nBody` }]);
  if (r.kind !== "skill") throw new Error("fixture is not a skill: " + r.reason);
  return r.skill;
}
function idsFor(fm: string, profile: Profile = "generic"): string[] {
  return runRules(build(fm), warningFrontmatterRules, { profile }).map((f) => f.ruleId);
}

describe("allowlists", () => {
  it("plugin allowlist is a superset of generic and keeps allowed-tools", () => {
    for (const k of GENERIC_ALLOWED_KEYS) expect(PLUGIN_ALLOWED_KEYS).toContain(k);
    expect(PLUGIN_ALLOWED_KEYS).toContain("allowed-tools");
    expect(PLUGIN_ALLOWED_KEYS).toContain("argument-hint");
  });
});

describe("W12 unknown frontmatter field", () => {
  it("fires on an unknown key", () => {
    expect(idsFor("name: a-b\ndescription: Use when testing\nauthr: me")).toContain("W12");
  });
  it("does not fire on allowed keys", () => {
    expect(idsFor("name: a-b\ndescription: Use when testing\nlicense: MIT")).not.toContain("W12");
  });
  it("does not fire on when_to_use (W13 owns it)", () => {
    const ids = idsFor("name: a-b\ndescription: Use when testing\nwhen_to_use: later");
    expect(ids).not.toContain("W12");
    expect(ids).toContain("W13");
  });
});

describe("W13 deprecated when_to_use", () => {
  it("fires regardless of case", () => {
    expect(idsFor("name: a-b\ndescription: Use when testing\nWhen_To_Use: later")).toContain("W13");
  });
  it("does not fire when absent", () => {
    expect(idsFor("name: a-b\ndescription: Use when testing")).not.toContain("W13");
  });
});

describe("W14 allowed-tools in plugin profile", () => {
  it("fires only under the claude-code-plugin profile", () => {
    const fm = "name: a-b\ndescription: Use when testing\nallowed-tools: Bash";
    expect(idsFor(fm, "generic")).not.toContain("W14");
    expect(idsFor(fm, "claude-code-plugin")).toContain("W14");
  });
});

describe("W15 duplicate / mixed-case keys", () => {
  it("fires on mixed-case duplicate keys", () => {
    expect(idsFor("Name: a-b\nname: a-b\ndescription: Use when testing")).toContain("W15");
  });
  it("does not fire for a duplicate description (E05 owns it)", () => {
    expect(idsFor("name: a-b\ndescription: one\ndescription: two")).not.toContain("W15");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/skill-lint/rules/warnings-frontmatter.test.ts`
Expected: FAIL — "Cannot find module './warnings-frontmatter'".

- [ ] **Step 3: Implement warnings-frontmatter.ts**

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/skill-lint/rules/warnings-frontmatter.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add lib/skill-lint/rules/warnings-frontmatter.ts lib/skill-lint/rules/warnings-frontmatter.test.ts
git commit -m "feat(engine): frontmatter warning rules W12-W15 with profile allowlists"
```

---

### Task 5: Metadata suggestion rules (`S01`, `S02`, `S03`, `S11`, `S15`)

**Files:**
- Create: `lib/skill-lint/rules/suggestions-metadata.ts`
- Test: `lib/skill-lint/rules/suggestions-metadata.test.ts`

**Interfaces:**
- Consumes: `mk`, model types, `parseSkill` (in tests)
- Produces: `export const suggestionMetadataRules: Rule[];` with ids `S01`, `S02`, `S03`, `S11`, `S15`

Rule semantics (spec §5):
- `S01`: `name` is a VALID kebab name and its first segment does not end in `ing` → one finding.
- `S02`: `description` (non-empty string) contains no quoted phrase `/"[^"]{3,}"/` → one finding.
- `S03`: `description` length `> 200` AND lacks `/do not use|don't use|not for/i` → one finding.
- `S11`: `license` key present but no `LICENSE(.txt|.md)?` file → one finding; OR that file present but no `license` key → one finding.
- `S15`: neither `data.version` nor `metadata.version` present → one finding.

- [ ] **Step 1: Write the failing tests**

`lib/skill-lint/rules/suggestions-metadata.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { suggestionMetadataRules } from "./suggestions-metadata";
import { runRules } from "./engine";
import { parseSkill } from "../parser/skill";
import type { ParsedSkill, SkillFile } from "../model";

function build(fm: string, files: SkillFile[] = []): ParsedSkill {
  const all = [{ path: "SKILL.md", content: `---\n${fm}\n---\nBody` }, ...files];
  const r = parseSkill(all);
  if (r.kind !== "skill") throw new Error("fixture is not a skill: " + r.reason);
  return r.skill;
}
function idsFor(fm: string, files: SkillFile[] = []): string[] {
  return runRules(build(fm, files), suggestionMetadataRules, { profile: "generic" }).map((f) => f.ruleId);
}

describe("S01 gerund naming", () => {
  it("fires when the first segment is not a gerund", () => {
    expect(idsFor("name: pdf-processor\ndescription: Use when testing")).toContain("S01");
  });
  it("does not fire on a gerund-first name", () => {
    expect(idsFor("name: processing-pdfs\ndescription: Use when testing")).not.toContain("S01");
  });
});

describe("S02 quoted trigger phrases", () => {
  it("fires when no quoted phrase is present", () => {
    expect(idsFor("name: a-b\ndescription: Use when reviewing pull requests")).toContain("S02");
  });
  it("does not fire when a quoted phrase is present", () => {
    expect(idsFor('name: a-b\ndescription: Use when the user says "review my PR"')).not.toContain("S02");
  });
});

describe("S03 negative triggers for broad scope", () => {
  it("fires on a long description with no negative trigger", () => {
    expect(idsFor(`name: a-b\ndescription: ${"Use when reviewing code. ".repeat(12)}`)).toContain("S03");
  });
  it("does not fire when a negative trigger is present", () => {
    expect(idsFor(`name: a-b\ndescription: ${"Use when reviewing code. ".repeat(12)} Do not use for infra.`)).not.toContain("S03");
  });
});

describe("S11 license consistency", () => {
  it("fires when license key exists but no LICENSE file", () => {
    expect(idsFor("name: a-b\ndescription: Use when testing\nlicense: MIT")).toContain("S11");
  });
  it("fires when a LICENSE file exists but no license key", () => {
    expect(idsFor("name: a-b\ndescription: Use when testing", [{ path: "LICENSE", content: "MIT" }])).toContain("S11");
  });
  it("does not fire when both are present", () => {
    expect(idsFor("name: a-b\ndescription: Use when testing\nlicense: MIT", [{ path: "LICENSE.txt", content: "MIT" }])).not.toContain("S11");
  });
});

describe("S15 versioning nudge", () => {
  it("fires when no version is declared", () => {
    expect(idsFor("name: a-b\ndescription: Use when testing")).toContain("S15");
  });
  it("does not fire when metadata.version is present", () => {
    expect(idsFor("name: a-b\ndescription: Use when testing\nmetadata:\n  version: 1.0.0")).not.toContain("S15");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/skill-lint/rules/suggestions-metadata.test.ts`
Expected: FAIL — "Cannot find module './suggestions-metadata'".

- [ ] **Step 3: Implement suggestions-metadata.ts**

```ts
import type { Rule } from "../model";
import { mk } from "./util";

const NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const QUOTED = /"[^"]{3,}"/;
const NEGATIVE_TRIGGER = /do not use|don't use|not for/i;
const LICENSE_FILE = /^LICENSE(\.(txt|md))?$/i;

function str(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

const s01: Rule = {
  id: "S01",
  severity: "suggestion",
  check(s) {
    const name = str(s.frontmatter.data["name"]);
    if (name === undefined || !NAME_RE.test(name)) return [];
    if (name.split("-")[0].endsWith("ing")) return [];
    return [
      mk("S01", "suggestion",
        `name "${name}" does not start with a gerund verb`,
        "Verb-first gerund names (creating-x, reviewing-y) read as capabilities and match how users phrase requests.",
        "Consider a verb-first gerund, e.g. processing-pdfs rather than pdf-processor."),
    ];
  },
};

const s02: Rule = {
  id: "S02",
  severity: "suggestion",
  check(s) {
    const desc = str(s.frontmatter.data["description"]);
    if (desc === undefined || desc.trim().length === 0 || QUOTED.test(desc)) return [];
    return [
      mk("S02", "suggestion",
        "description has no quoted trigger phrase",
        "Quoting the exact phrases users type (\"review my PR\") sharpens the match between a request and the skill.",
        'Add a quoted example phrase to the description, e.g. Use when the user says "…".'),
    ];
  },
};

const s03: Rule = {
  id: "S03",
  severity: "suggestion",
  check(s) {
    const desc = str(s.frontmatter.data["description"]);
    if (desc === undefined || desc.length <= 200 || NEGATIVE_TRIGGER.test(desc)) return [];
    return [
      mk("S03", "suggestion",
        "broad description has no negative trigger",
        "A wide-scoped skill fires on unrelated requests unless it also says when NOT to trigger.",
        'Add a negative trigger, e.g. "Do not use for …".'),
    ];
  },
};

const s11: Rule = {
  id: "S11",
  severity: "suggestion",
  check(s) {
    const hasKey = s.frontmatter.data["license"] !== undefined;
    const hasFile = s.files.some((f) => LICENSE_FILE.test(f.path));
    if (hasKey && !hasFile) {
      return [
        mk("S11", "suggestion",
          "license is declared but no LICENSE file is included",
          "Declaring a license without shipping its text leaves the terms unstated for anyone who installs the skill.",
          "Add a LICENSE (or LICENSE.txt/.md) file matching the declared license."),
      ];
    }
    if (hasFile && !hasKey) {
      return [
        mk("S11", "suggestion",
          "a LICENSE file is present but no license field is set",
          "The frontmatter license field is what tools read; a bare file is easy to miss.",
          "Add license: <spdx-id> to the frontmatter to match the LICENSE file."),
      ];
    }
    return [];
  },
};

const s15: Rule = {
  id: "S15",
  severity: "suggestion",
  check(s) {
    const data = s.frontmatter.data;
    const md = data["metadata"];
    const hasMetaVersion =
      !!md && typeof md === "object" && !Array.isArray(md) && (md as Record<string, unknown>)["version"] !== undefined;
    if (data["version"] !== undefined || hasMetaVersion) return [];
    return [
      mk("S15", "suggestion",
        "no version is declared for the skill",
        "Versioning lets consumers tell editions apart and know when to re-import an updated skill.",
        "Add metadata.version (e.g. 1.0.0) so changes are traceable."),
    ];
  },
};

export const suggestionMetadataRules: Rule[] = [s01, s02, s03, s11, s15];
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/skill-lint/rules/suggestions-metadata.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add lib/skill-lint/rules/suggestions-metadata.ts lib/skill-lint/rules/suggestions-metadata.test.ts
git commit -m "feat(engine): metadata suggestion rules S01-S03, S11, S15"
```

---

### Task 6: Body suggestion rules (`S04`, `S08`, `S09`, `S10`, `S13`, `S14`)

**Files:**
- Create: `lib/skill-lint/rules/suggestions-body.ts`
- Test: `lib/skill-lint/rules/suggestions-body.test.ts`

**Interfaces:**
- Consumes: `mk`, model types, `parseBody` (`../parser/markdown`), `parseSkill` (in tests)
- Produces: `export const suggestionBodyRules: Rule[];` with ids `S04`, `S08`, `S09`, `S10`, `S13`, `S14`

Rule semantics (spec §5):
- `S04`: `body.headings.length === 0` AND `body.lines.length > 20` → one finding.
- `S08`: prose line with `>= 3` matches of `/\bor\b/i` → one finding per line (cap 3).
- `S09`: `>= 3` numbered-step lines (`/^\s*\d+\.\s/`) AND no heading matching `/troubleshoot|common (issues|mistakes|problems)/i` → one finding.
- `S10`: `>= 2` prose lines matching `/\b(validate|verify|double-check)\b/i` AND no files under `scripts/` → one finding.
- `S13`: a normalized prose line (`> 60` chars, lowercased, whitespace-collapsed) present in BOTH SKILL.md and any reference `.md`, with `>= 3` such shared lines → one finding.
- `S14`: `body.wordCount > 3000` AND depth-2 headings `>= 8` → one finding.

- [ ] **Step 1: Write the failing tests**

`lib/skill-lint/rules/suggestions-body.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { suggestionBodyRules } from "./suggestions-body";
import { runRules } from "./engine";
import { parseSkill } from "../parser/skill";
import type { ParsedSkill, SkillFile } from "../model";

function build(body: string, files: SkillFile[] = []): ParsedSkill {
  const all = [
    { path: "SKILL.md", content: `---\nname: a-b\ndescription: Use when testing body suggestions\n---\n${body}` },
    ...files,
  ];
  const r = parseSkill(all);
  if (r.kind !== "skill") throw new Error("fixture is not a skill: " + r.reason);
  return r.skill;
}
function idsFor(body: string, files: SkillFile[] = []): string[] {
  return runRules(build(body, files), suggestionBodyRules, { profile: "generic" }).map((f) => f.ruleId);
}

describe("S04 no headings", () => {
  it("fires on a long body without headings", () => {
    expect(idsFor(Array.from({ length: 25 }, (_, i) => `line ${i}`).join("\n"))).toContain("S04");
  });
  it("does not fire when headings exist", () => {
    expect(idsFor("# Title\n" + Array.from({ length: 25 }, () => "line").join("\n"))).not.toContain("S04");
  });
});

describe("S08 excessive alternatives", () => {
  it("fires on a line with 3+ 'or'", () => {
    expect(idsFor("Choose red or green or blue or yellow.")).toContain("S08");
  });
  it("does not fire on a single 'or'", () => {
    expect(idsFor("Choose red or green.")).not.toContain("S08");
  });
});

describe("S09 missing troubleshooting", () => {
  it("fires on multi-step body with no troubleshooting heading", () => {
    expect(idsFor("## Steps\n1. do a\n2. do b\n3. do c")).toContain("S09");
  });
  it("does not fire when a troubleshooting heading exists", () => {
    expect(idsFor("## Steps\n1. do a\n2. do b\n3. do c\n## Troubleshooting\ntips")).not.toContain("S09");
  });
});

describe("S10 prose-only validation", () => {
  it("fires when validation is prose and there is no script", () => {
    expect(idsFor("Validate the output.\nVerify the schema.")).toContain("S10");
  });
  it("does not fire when a script exists", () => {
    expect(idsFor("Validate the output.\nVerify the schema.", [{ path: "scripts/check.py", content: "print(1)" }])).not.toContain("S10");
  });
});

describe("S13 duplicated content", () => {
  it("fires when 3+ long lines are shared with a reference", () => {
    const shared = [
      "This is a sufficiently long shared sentence number one that exceeds sixty characters.",
      "This is a sufficiently long shared sentence number two that exceeds sixty characters.",
      "This is a sufficiently long shared sentence number three that exceeds sixty chars ok.",
    ].join("\n");
    expect(idsFor(shared, [{ path: "references/a.md", content: shared }])).toContain("S13");
  });
  it("does not fire without enough overlap", () => {
    expect(idsFor("short body", [{ path: "references/a.md", content: "different content entirely" }])).not.toContain("S13");
  });
});

describe("S14 mega-skill", () => {
  it("fires on a long body with many depth-2 headings", () => {
    const headings = Array.from({ length: 8 }, (_, i) => `## Section ${i}\n${"word ".repeat(400)}`).join("\n");
    expect(idsFor(headings)).toContain("S14");
  });
  it("does not fire on a small body", () => {
    expect(idsFor("## One\n## Two\nshort")).not.toContain("S14");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/skill-lint/rules/suggestions-body.test.ts`
Expected: FAIL — "Cannot find module './suggestions-body'".

- [ ] **Step 3: Implement suggestions-body.ts**

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/skill-lint/rules/suggestions-body.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add lib/skill-lint/rules/suggestions-body.ts lib/skill-lint/rules/suggestions-body.test.ts
git commit -m "feat(engine): body suggestion rules S04, S08-S10, S13-S14"
```

---

### Task 7: File suggestion rules (`S05`, `S06`, `S07`, `S12`)

**Files:**
- Create: `lib/skill-lint/rules/suggestions-files.ts`
- Test: `lib/skill-lint/rules/suggestions-files.test.ts`

**Interfaces:**
- Consumes: `mk`, model types, `parseSkill` (in tests)
- Produces: `export const suggestionFileRules: Rule[];` with ids `S05`, `S06`, `S07`, `S12`

Rule semantics (spec §5):
- `S05`: non-SKILL `.md` file with `> 300` lines whose first 30 lines lack `/contents|table of contents/i` → one finding per file (cap 3).
- `S06`: file path matching `/(^|\/)(doc|file|notes?|temp|misc)\d*\.md$/i` → one finding per file (cap 3).
- `S07`: skill has files under `references|reference|resources|examples|scripts|assets` AND body has no heading matching `/additional resources|resources|references/i` → one finding.
- `S12`: file under `scripts/` whose path never appears in the body (links or raw text) → one finding per file (cap 3).

- [ ] **Step 1: Write the failing tests**

`lib/skill-lint/rules/suggestions-files.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { suggestionFileRules } from "./suggestions-files";
import { runRules } from "./engine";
import { parseSkill } from "../parser/skill";
import type { SkillFile } from "../model";

function idsFor(files: SkillFile[]): string[] {
  const r = parseSkill(files);
  if (r.kind !== "skill") throw new Error("fixture is not a skill: " + r.reason);
  return runRules(r.skill, suggestionFileRules, { profile: "generic" }).map((f) => f.ruleId);
}
const SKILL = (body: string): SkillFile => ({
  path: "SKILL.md",
  content: `---\nname: a-b\ndescription: Use when testing file suggestions\n---\n${body}`,
});

describe("S05 long reference without TOC", () => {
  it("fires on a 300+ line reference lacking a TOC", () => {
    const big = Array.from({ length: 320 }, (_, i) => `line ${i}`).join("\n");
    expect(idsFor([SKILL("See [a](references/a.md)"), { path: "references/a.md", content: big }])).toContain("S05");
  });
  it("does not fire when a TOC is present", () => {
    const big = "# Contents\n" + Array.from({ length: 320 }, (_, i) => `line ${i}`).join("\n");
    expect(idsFor([SKILL("See [a](references/a.md)"), { path: "references/a.md", content: big }])).not.toContain("S05");
  });
});

describe("S06 generic filenames", () => {
  it("fires on doc1.md / file2.md", () => {
    expect(idsFor([SKILL("[a](references/doc1.md)"), { path: "references/doc1.md", content: "x" }])).toContain("S06");
  });
  it("does not fire on a descriptive name", () => {
    expect(idsFor([SKILL("[a](references/api.md)"), { path: "references/api.md", content: "x" }])).not.toContain("S06");
  });
});

describe("S07 missing resources section", () => {
  it("fires when subdir content exists but no resources heading", () => {
    expect(idsFor([SKILL("Just a body."), { path: "references/a.md", content: "x" }])).toContain("S07");
  });
  it("does not fire when a resources heading exists", () => {
    expect(idsFor([SKILL("## Additional Resources\n[a](references/a.md)"), { path: "references/a.md", content: "x" }])).not.toContain("S07");
  });
});

describe("S12 undocumented scripts", () => {
  it("fires when a script is never referenced", () => {
    expect(idsFor([SKILL("No mention here."), { path: "scripts/run.py", content: "print(1)" }])).toContain("S12");
  });
  it("does not fire when the script path appears in the body", () => {
    expect(idsFor([SKILL("Run `scripts/run.py` first."), { path: "scripts/run.py", content: "print(1)" }])).not.toContain("S12");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/skill-lint/rules/suggestions-files.test.ts`
Expected: FAIL — "Cannot find module './suggestions-files'".

- [ ] **Step 3: Implement suggestions-files.ts**

```ts
import type { ParsedSkill, Rule, SkillFile } from "../model";
import { mk } from "./util";

const CAP = 3;

const TOC_RE = /contents|table of contents/i;
const GENERIC_FILENAME = /(^|\/)(doc|file|notes?|temp|misc)\d*\.md$/i;
const SUBDIR_RE = /^(references|reference|resources|examples|scripts|assets)\//;
const RESOURCES_H = /additional resources|resources|references/i;

function nonSkillMd(s: ParsedSkill): SkillFile[] {
  return s.files.filter((f) => f.path !== s.skillFile.path && f.path.toLowerCase().endsWith(".md"));
}

const s05: Rule = {
  id: "S05",
  severity: "suggestion",
  check(s) {
    return nonSkillMd(s)
      .map((f) => ({ f, lines: f.content.split("\n") }))
      .filter(({ lines }) => lines.length > 300 && !TOC_RE.test(lines.slice(0, 30).join("\n")))
      .slice(0, CAP)
      .map(({ f, lines }) =>
        mk("S05", "suggestion",
          `"${f.path}" is ${lines.length} lines with no table of contents`,
          "A long reference is hard for the agent to navigate; a table of contents lets it jump straight to the relevant part.",
          "Add a Contents section listing the reference's headings.",
          { file: f.path })
      );
  },
};

const s06: Rule = {
  id: "S06",
  severity: "suggestion",
  check(s) {
    return s.files
      .filter((f) => GENERIC_FILENAME.test(f.path))
      .slice(0, CAP)
      .map((f) =>
        mk("S06", "suggestion",
          `generic file name "${f.path}"`,
          "Names like doc1.md tell the agent nothing about the file's contents, so it cannot decide whether to read it.",
          "Rename the file after its topic, e.g. api-reference.md.",
          { file: f.path })
      );
  },
};

const s07: Rule = {
  id: "S07",
  severity: "suggestion",
  check(s) {
    const hasSubdirContent = s.files.some((f) => SUBDIR_RE.test(f.path));
    const hasResourcesHeading = s.body.headings.some((h) => RESOURCES_H.test(h.text));
    if (!hasSubdirContent || hasResourcesHeading) return [];
    return [
      mk("S07", "suggestion",
        "supporting files exist but the body has no resources section",
        "Files the body never surfaces are easy for the agent to overlook; a resources section signposts them.",
        "Add an Additional Resources section linking to the supporting files."),
    ];
  },
};

const s12: Rule = {
  id: "S12",
  severity: "suggestion",
  check(s) {
    return s.files
      .filter((f) => f.path.startsWith("scripts/"))
      .filter(
        (f) => !s.body.raw.includes(f.path) && !s.body.links.some((l) => l.target.replace(/^\.\//, "").split("#")[0] === f.path)
      )
      .slice(0, CAP)
      .map((f) =>
        mk("S12", "suggestion",
          `script "${f.path}" is never referenced in SKILL.md`,
          "A script the body never mentions will not be run — the agent has no idea it exists or how to use it.",
          "Document the script in the body: what it does and how to invoke it.",
          { file: f.path })
      );
  },
};

export const suggestionFileRules: Rule[] = [s05, s06, s07, s12];
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/skill-lint/rules/suggestions-files.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add lib/skill-lint/rules/suggestions-files.ts lib/skill-lint/rules/suggestions-files.test.ts
git commit -m "feat(engine): file suggestion rules S05-S07, S12"
```

---

### Task 8: Wire all packs into `allRules` + update the integration test

**Files:**
- Edit: `lib/skill-lint/index.ts` (extend the `allRules` array literal)
- Edit: `lib/skill-lint/index.test.ts` (tighten valid-full assertions; keep kitchen-sink poor)

**Interfaces:**
- Consumes: all seven rule packs from Tasks 1–7
- Produces: the complete catalog `allRules` (`E01`–`E12` + `W01`–`W21` + `S01`–`S15`)

Context — the current `index.ts` (from Plan 1) is:
```ts
/** Full rule catalog. Plan 2 appends the W and S rule packs here. */
export const allRules: Rule[] = [...frontmatterErrorRules, ...structureErrorRules];
```

- [ ] **Step 1: Update the integration test FIRST (tighten valid-full)**

Replace the `valid-full` test in `lib/skill-lint/index.test.ts` so it also asserts **zero warnings** (suggestions may fire; each costs 1 point) and keeps `score >= 90`. Apply this exact edit — replace:

```ts
      expect(r.findings.filter((f) => f.severity === "error")).toEqual([]);
      expect(r.score.value).toBeGreaterThanOrEqual(90);
```

with:

```ts
      expect(r.findings.filter((f) => f.severity === "error")).toEqual([]);
      expect(r.findings.filter((f) => f.severity === "warning")).toEqual([]);
      expect(r.score.value).toBeGreaterThanOrEqual(90);
```

Leave the `kitchen-sink` test unchanged — it still asserts `score.value < 40` and `band === "poor"`, which holds (adding warnings/suggestions to an already error-heavy skill can only lower the score).

- [ ] **Step 2: Run the integration test to verify it FAILS**

Run: `npx vitest run lib/skill-lint/index.test.ts`
Expected: FAIL — the valid-full test fails because the new warning rules are not yet wired into `allRules`... actually they are not imported yet, so `allRules` still holds only errors and no warnings fire, meaning the new `warning` assertion passes vacuously. To make the test meaningfully drive the wiring, this step's expected result is: test PASSES vacuously but `allRules` does not yet contain W/S rules. Proceed to Step 3 to wire them, then Step 4 re-runs the FULL suite (which is where the real verification happens: every W/S pack test plus the tightened integration assertions all green together).

> Note for the implementer: the genuine failing-then-passing signal for the W/S rules lives in each pack's own test file (Tasks 1–7). This task is pure wiring; its verification is the full green suite in Step 4.

- [ ] **Step 3: Extend the `allRules` literal in `index.ts`**

Replace the imports block and the `allRules` declaration. Add the seven pack imports after the existing error-rule imports:

```ts
import type { Finding, ParsedSkill, Profile, Rule, ScoreResult, SkillFile, TokenReport } from "./model";
import { parseSkill } from "./parser/skill";
import { runRules } from "./rules/engine";
import { frontmatterErrorRules } from "./rules/errors-frontmatter";
import { structureErrorRules } from "./rules/errors-structure";
import { warningDescriptionRules } from "./rules/warnings-description";
import { warningBodyRules } from "./rules/warnings-body";
import { warningStructureRules } from "./rules/warnings-structure";
import { warningFrontmatterRules } from "./rules/warnings-frontmatter";
import { suggestionMetadataRules } from "./rules/suggestions-metadata";
import { suggestionBodyRules } from "./rules/suggestions-body";
import { suggestionFileRules } from "./rules/suggestions-files";
import { computeScore } from "./score";
import { tokenReport } from "./tokens";
```

Then replace the `allRules` declaration with the full catalog (extend the literal — do not `push()`):

```ts
/** Full rule catalog: errors E01–E12, warnings W01–W21, suggestions S01–S15. */
export const allRules: Rule[] = [
  ...frontmatterErrorRules,
  ...structureErrorRules,
  ...warningDescriptionRules,
  ...warningBodyRules,
  ...warningStructureRules,
  ...warningFrontmatterRules,
  ...suggestionMetadataRules,
  ...suggestionBodyRules,
  ...suggestionFileRules,
];
```

Leave `lintSkill` and the re-exports at the bottom of the file unchanged.

- [ ] **Step 4: Run the FULL suite**

Run: `npm test`
Expected: PASS — every test file green: the Plan 1 files (tokens, frontmatter, markdown, skill, engine, errors-frontmatter, errors-structure, score, index) plus the seven new pack tests (warnings-description, warnings-body, warnings-structure, warnings-frontmatter, suggestions-metadata, suggestions-body, suggestions-files). In particular `index.test.ts` valid-full now passes with zero errors, zero warnings, and `score >= 90` (only suggestions `S01`, `S02`, `S11`, `S15` fire → score `96`), and kitchen-sink stays `< 40` / `poor`.

- [ ] **Step 5: Verify the static build still passes**

Run: `npm run build`
Expected: build succeeds; `out/index.html` exists (`ls out/index.html`). The engine additions must not break the app build.

- [ ] **Step 6: Commit**

```bash
git add lib/skill-lint/index.ts lib/skill-lint/index.test.ts
git commit -m "feat(engine): wire W01-W21 and S01-S15 into the rule catalog"
```

---

## Self-Review (run after writing, before handoff)

1. **Rule coverage:** all 21 warnings and 15 suggestions are implemented — Task 1 (`W02`,`W03`,`W04`,`W05`,`W07`), Task 2 (`W01`,`W06`,`W08`,`W09`,`W16`,`W20`,`W21`), Task 3 (`W10`,`W11`,`W17`,`W18`,`W19`), Task 4 (`W12`,`W13`,`W14`,`W15`), Task 5 (`S01`,`S02`,`S03`,`S11`,`S15`), Task 6 (`S04`,`S08`,`S09`,`S10`,`S13`,`S14`), Task 7 (`S05`,`S06`,`S07`,`S12`). No gaps, no duplicates.
2. **Placeholder scan:** none — every step carries complete rule and test code and exact vitest commands. No TODO / "similar to" / ellipsis stand-ins.
3. **Type consistency vs `model.ts`:** every rule is a `Rule` (`{ id, severity, profiles?, check }`); every finding is built via `mk(id, severity, message, why, howToFix, extra?)` matching the `util.ts` signature; `AutoFix` in `W08` matches `{ label, apply(files: SkillFile[]): SkillFile[] }`; `ctx` is used only by `W12` (`ctx.profile`); `W14` uses `profiles: ["claude-code-plugin"]` filtered by the existing engine.
4. **Never-throw audit:** all frontmatter access goes through `str()` / `typeof` guards (`W02`–`W05`,`W07`,`S01`–`S03`,`S15`); `S15` guards `metadata` with `typeof === "object" && !Array.isArray`; body/file iteration never indexes past bounds; regex `.match` with `/g` is used read-only for counting. No rule can throw on missing/non-string/object frontmatter values or empty file lists.
5. **Bounded findings:** per-line/per-file rules cap output — `W08`,`W09`,`W11`,`W17`,`W18`,`W19` at 5; `W16`,`S05`,`S06`,`S08`,`S12` at 3; `W10` at 5. Single-finding rules (`W01`,`W06`,`W20`,`W21`,`S04`,`S07`,`S09`,`S10`,`S13`,`S14`) return at most one.
6. **Ownership boundaries (no double-firing across severities):** `W12` skips `when_to_use` (owned by `W13`); `W15` skips `description` (owned by `E05`); `W02`–`W05`/`S02` skip missing/empty descriptions (owned by `E05`); `W03` skips `> 1024` (owned by `E05`). `allowed-tools` stays in the plugin allowlist so `W14`, not `W12`, flags it.
7. **valid-full invariant:** the fixture fires zero errors and zero warnings; only suggestions `S01` (name "valid" not gerund), `S02` (no quoted phrase), `S11` (`license: MIT` with no LICENSE file), and `S15` (no version) fire → score `96 ≥ 90`, satisfying the tightened Task 8 assertion.
