# Skillsmith Plan 4: Guided Skill-Creation Wizard (`/new`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A five-step, client-only wizard at `/new` that walks an author from raw intent to a spec-compliant, lint-clean skill. Pure logic (archetype templates, assembler, state model, name validation) is fully unit-tested; the assembled output of every archetype lints with **zero error-severity findings** using the real Plan 1 engine. The final step hands off to the workspace (Plan 3) or downloads a `.zip`.

**Architecture:** Three pure modules under `lib/wizard/` (`archetypes.ts`, `state.ts`, `name.ts`, `assemble.ts`) contain all logic and are tested with Vitest — none import React. The UI lives under `components/wizard/` (a `useReducer` hook plus five step components and shared widgets) and `app/new/page.tsx` (`"use client"`). Components are controlled: every step receives `state` + `dispatch`, so they render deterministically from state and test in jsdom without a store. The real engine (`lib/skill-lint`) runs in-browser on the assembled files at the review step. Spec: `docs/specs/2026-07-04-skillsmith-design.md` §8.

**Tech Stack:** Next.js 15 (static export) + React 19 + Tailwind 4, TypeScript strict, Vitest 3 (+ jsdom + @testing-library/react from Plan 3). Node 22. npm. No UI libraries.

**Roadmap context:** This is Plan 4 of 5. Plan 1 shipped the engine (`lintSkill`, `estimateTokens`, `SkillFile`); Plan 2 added W/S rules to `allRules`; Plan 3 shipped the workspace UI, `lib/handoff.ts`, `lib/zip.ts`, `components/SiteHeader.tsx`, and the Vitest+jsdom wiring; Plan 5 = GitHub importer. **Plan 4 depends on Plans 1–3 being merged.**

## Global Constraints

- 100% static: no server code, no API routes. Everything the wizard does runs in the browser.
- Nothing under `lib/wizard/` may import React or Next.js — pure TS. It may import `lib/skill-lint` types/functions (also pure).
- All `SkillFile.path` values use forward slashes, relative to the skill folder (`SKILL.md`, `references/api.md`).
- The assembled skill MUST lint with zero **error-severity** findings for every archetype filled with reasonable defaults. This is the key quality gate (Task 2, Step 5).
- Every archetype template body is real, well-formed skill prose: imperative voice, **no second person** ("you"), "Use when …" trigger framing, quoted example triggers, headings, and **no `<`/`>`** anywhere in frontmatter values (would trip E06). Any relative link or backtick path that appears in a template body MUST correspond to a real `extraFiles` entry (or sit inside a fenced code block, which the parser excludes from link resolution) so E09 never fires.
- UI copy in English. Code comments in English. Neutral dark-friendly Tailwind palette (`neutral-950/900/800` surfaces, `neutral-100/400` text, `indigo-400` accent, `emerald`/`amber`/`red` for ok/warn/error). No UI libs.
- Run all commands from repo root `C:\Users\richa\projects\skillsmith`.

## Interfaces consumed (provided by earlier plans — DO NOT reimplement)

```ts
// lib/skill-lint (Plan 1/2) — the real engine, imported by the assembler test and the review step
import { lintSkill, estimateTokens, type SkillFile, type LintOutcome } from "@/lib/skill-lint";
// lintSkill(files: SkillFile[], opts?: { profile?: Profile; dirName?: string }): LintOutcome
// estimateTokens(text: string): number

// lib/handoff.ts (Plan 3) — the wizard's "Open in Workspace" action
import { stashIncomingSkill } from "@/lib/handoff";
// stashIncomingSkill(files: SkillFile[], opts?: { dirName?: string; source?: string }): void

// lib/zip.ts (Plan 3) — the wizard's "Download .zip" action
import { zipSkill, downloadBlob } from "@/lib/zip";
// zipSkill(files: SkillFile[], rootDir: string): Uint8Array
// downloadBlob(filename: string, data: Uint8Array | string, mime: string): void

// components/SiteHeader.tsx (Plan 3) — already rendered by app/layout.tsx; the wizard adds NO nav.

// Vitest wiring (Plan 3, Task 1): vitest.config.ts `include` matches
//   ["lib/**/*.test.{ts,tsx}", "components/**/*.test.tsx", "app/**/*.test.tsx"];
// jsdom + @testing-library/react + @testing-library/jest-dom matchers are registered via a setup file.
// Component tests opt into jsdom with the `// @vitest-environment jsdom` pragma on line 1.
```

---

### Task 1: Archetype template catalog (`lib/wizard/archetypes.ts`)

**Files:**
- Create: `lib/wizard/archetypes.ts`
- Test: `lib/wizard/archetypes.test.ts`

**Interfaces:**
- Consumes: nothing (pure data)
- Produces:

```ts
export interface ArchetypeSection {
  id: string;            // stable key used in WizardState.sections
  title: string;         // rendered as "## {title}" and as the editor label
  placeholder: string;   // textarea placeholder in Step 4
  defaultContent: string; // seeded body prose (imperative, no second person)
}
export interface ArchetypeFile { path: string; content: string }
export interface Archetype {
  id: string;
  title: string;
  blurb: string;
  advanced?: boolean;      // pipeline-orchestrator only
  dirs: string[];          // folders the archetype implies (display hint)
  sections: ArchetypeSection[];
  extraFiles: ArchetypeFile[]; // references/*.md etc. — must satisfy every body link
}
export const archetypes: Archetype[];               // exactly 8
export function getArchetype(id: string | null): Archetype | undefined;
```

- [ ] **Step 1: Write the failing shape tests**

`lib/wizard/archetypes.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { archetypes, getArchetype } from "./archetypes";

describe("archetype catalog", () => {
  it("contains exactly 8 archetypes with unique ids", () => {
    expect(archetypes).toHaveLength(8);
    const ids = archetypes.map((a) => a.id);
    expect(new Set(ids).size).toBe(8);
  });

  it("covers the 8 spec archetypes", () => {
    const ids = archetypes.map((a) => a.id);
    for (const id of [
      "technique", "reference", "document-generator", "style-guide",
      "audit-checklist", "graduated-critique", "expert-persona", "pipeline-orchestrator",
    ]) {
      expect(ids).toContain(id);
    }
  });

  it("marks only the pipeline orchestrator as advanced", () => {
    expect(getArchetype("pipeline-orchestrator")!.advanced).toBe(true);
    expect(archetypes.filter((a) => a.advanced)).toHaveLength(1);
  });

  it("every archetype has >=1 section with unique non-empty ids, titles and content", () => {
    for (const a of archetypes) {
      expect(a.title.length).toBeGreaterThan(0);
      expect(a.blurb.length).toBeGreaterThan(0);
      expect(a.sections.length).toBeGreaterThan(0);
      const sids = a.sections.map((s) => s.id);
      expect(new Set(sids).size).toBe(sids.length);
      for (const s of a.sections) {
        expect(s.id).not.toBe("");
        expect(s.title.trim().length).toBeGreaterThan(0);
        expect(s.placeholder.trim().length).toBeGreaterThan(0);
        expect(s.defaultContent.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("extraFile paths are unique, non-empty and forward-slashed", () => {
    for (const a of archetypes) {
      const paths = a.extraFiles.map((f) => f.path);
      expect(new Set(paths).size).toBe(paths.length);
      for (const f of a.extraFiles) {
        expect(f.path).not.toBe("");
        expect(f.path).not.toContain("\\");
        expect(f.content.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("no frontmatter-hostile characters and no second person in default content", () => {
    for (const a of archetypes) {
      for (const s of a.sections) {
        expect(s.defaultContent).not.toMatch(/\byou\b/i);
      }
    }
  });

  it("getArchetype resolves by id and tolerates null/unknown", () => {
    expect(getArchetype("technique")!.id).toBe("technique");
    expect(getArchetype(null)).toBeUndefined();
    expect(getArchetype("nope")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/wizard/archetypes.test.ts`
Expected: FAIL — "Cannot find module './archetypes'".

- [ ] **Step 3: Implement archetypes.ts**

> Template rules baked in: imperative voice, no "you"; every markdown link / backtick path resolves to an `extraFiles` entry (only `reference` and `expert-persona` use links); directory-tree examples live inside fenced code blocks so the parser ignores them; sub-skill references in `pipeline-orchestrator` are bare names (no slash, no link).

```ts
export interface ArchetypeSection {
  id: string;
  title: string;
  placeholder: string;
  defaultContent: string;
}
export interface ArchetypeFile {
  path: string;
  content: string;
}
export interface Archetype {
  id: string;
  title: string;
  blurb: string;
  advanced?: boolean;
  dirs: string[];
  sections: ArchetypeSection[];
  extraFiles: ArchetypeFile[];
}

const technique: Archetype = {
  id: "technique",
  title: "Technique / How-To",
  blurb: "A single-file skill that teaches one repeatable technique end to end.",
  dirs: [],
  sections: [
    {
      id: "overview",
      title: "Overview",
      placeholder: "State the single technique and the outcome it produces.",
      defaultContent:
        "State the single technique this skill teaches in one or two sentences. Name the concrete outcome it produces and the context where it applies. Keep the scope to one capability so the agent loads it only when relevant.",
    },
    {
      id: "when-to-use",
      title: "When To Use",
      placeholder: "List the observable conditions that should trigger the technique.",
      defaultContent:
        "List the exact situations that should trigger this technique. Prefer observable conditions over vague intent. Exclude adjacent tasks that belong to a different skill.",
    },
    {
      id: "steps",
      title: "Steps",
      placeholder: "Number the atomic, verifiable actions in order.",
      defaultContent:
        "1. Describe the first concrete action to take.\n2. Describe the second action, naming any required inputs.\n3. Continue until the outcome is reached.\n\nKeep each step atomic and independently verifiable.",
    },
    {
      id: "example",
      title: "Example",
      placeholder: "Walk through one small worked example.",
      defaultContent:
        "Walk through one worked example from input to output. Choose the smallest case that still demonstrates the technique end to end.",
    },
    {
      id: "pitfalls",
      title: "Common Pitfalls",
      placeholder: "Name the mistakes that most often break the technique.",
      defaultContent:
        "Note the mistakes that most often break this technique and how to avoid each one. Flag any step that can silently produce a wrong result.",
    },
  ],
  extraFiles: [],
};

const reference: Archetype = {
  id: "reference",
  title: "Reference / Documentation",
  blurb: "A small SKILL.md that fans out to reference files, one topic per file.",
  dirs: ["references"],
  sections: [
    {
      id: "overview",
      title: "Overview",
      placeholder: "Summarize the domain and state that detail lives under references/.",
      defaultContent:
        "Summarize the domain this reference covers and who relies on it. Keep this file small: the SKILL.md is an index and the detail lives under references/.",
    },
    {
      id: "how-to-navigate",
      title: "How To Navigate",
      placeholder: "Point to each reference file and say when to open it.",
      defaultContent:
        "Load the reference file that matches the task:\n\n- Read [concepts](references/concepts.md) for background definitions and the mental model.\n- Read [api](references/api.md) for the full field-by-field specification.\n\nOpen only the file needed for the current task to keep context small.",
    },
    {
      id: "quick-reference",
      title: "Quick Reference",
      placeholder: "The handful of high-frequency facts needed in most cases.",
      defaultContent:
        "Provide the few facts needed in most cases so the agent rarely has to open a reference file. Keep this list short and high-frequency; move anything detailed into references/.",
    },
  ],
  extraFiles: [
    {
      path: "references/concepts.md",
      content:
        "# Concepts\n\nDefine each core term precisely. Group related terms under headings and keep one concept per section so the agent can scan quickly.\n",
    },
    {
      path: "references/api.md",
      content:
        "# API Reference\n\nDocument each field or endpoint with its type, whether it is required, and a one-line description. Add a short example for any non-obvious case.\n",
    },
  ],
};

const documentGenerator: Archetype = {
  id: "document-generator",
  title: "Document Generator",
  blurb: "Collects inputs against a checklist, then emits a fixed output template.",
  dirs: [],
  sections: [
    {
      id: "overview",
      title: "Overview",
      placeholder: "Name the document type produced and the decision it supports.",
      defaultContent:
        "Describe the document type this skill produces and the decision it supports. Generate consistent structure on every run by following the template below.",
    },
    {
      id: "input-checklist",
      title: "Input Checklist",
      placeholder: "The inputs to gather before drafting anything.",
      defaultContent:
        "Gather every input before drafting:\n\n- [ ] Primary subject or title\n- [ ] Target audience and reading level\n- [ ] Required sections and their order\n- [ ] Source facts or data to include\n\nRequest any missing input rather than inventing it.",
    },
    {
      id: "output-template",
      title: "Output Template",
      placeholder: "The exact structure of the generated document.",
      defaultContent:
        "Produce the document using this structure:\n\n```\n# {{title}}\n\n## Summary\n{{one-paragraph summary}}\n\n## Details\n{{body organized by the required sections}}\n\n## Next Steps\n{{concrete follow-up actions}}\n```\n\nReplace every placeholder and drop any section that has no content.",
    },
    {
      id: "quality-bar",
      title: "Quality Bar",
      placeholder: "The conditions that make a draft unacceptable.",
      defaultContent:
        "Reject a draft that leaves placeholders unfilled, omits a required section, or contradicts a source fact. Prefer concise prose over padding.",
    },
  ],
  extraFiles: [],
};

const styleGuide: Archetype = {
  id: "style-guide",
  title: "Style / Voice Guide",
  blurb: "Enforces a voice with swap tables and a short list of non-negotiables.",
  dirs: [],
  sections: [
    {
      id: "overview",
      title: "Overview",
      placeholder: "Define the voice and the surfaces it applies to.",
      defaultContent:
        "Define the voice this guide enforces and the surfaces it applies to. Apply every rule below when drafting or editing.",
    },
    {
      id: "non-negotiables",
      title: "Non-Negotiables",
      placeholder: "Rules that apply without exception.",
      defaultContent:
        "Apply these rules without exception:\n\n- Lead with the conclusion, then support it.\n- Keep sentences under 25 words where possible.\n- Cut any sentence that adds no information.",
    },
    {
      id: "swap-table",
      title: "Swap Table",
      placeholder: "Phrasings to replace with better phrasings.",
      defaultContent:
        "Replace the left phrasing with the right phrasing:\n\n| Avoid | Prefer |\n| --- | --- |\n| passive hedging | direct claims |\n| filler adverbs | precise verbs |\n| jargon without context | plain language |",
    },
    {
      id: "before-and-after",
      title: "Before And After",
      placeholder: "One rewrite per rule showing the contrast.",
      defaultContent:
        "Show one rewrite per rule. Present the weak version first, then the corrected version, so the contrast is explicit.",
    },
  ],
  extraFiles: [],
};

const auditChecklist: Archetype = {
  id: "audit-checklist",
  title: "Audit Checklist",
  blurb: "Scores an artifact against a numeric rubric and reports remediation.",
  dirs: [],
  sections: [
    {
      id: "overview",
      title: "Overview",
      placeholder: "State what is evaluated and the standard measured against.",
      defaultContent:
        "State what this audit evaluates and the standard it measures against. Produce a numeric score plus actionable findings on every run.",
    },
    {
      id: "rubric",
      title: "Scoring Rubric",
      placeholder: "The dimensions and their scoring bands.",
      defaultContent:
        "Score each dimension from 0 to 5:\n\n| Dimension | 0-1 | 2-3 | 4-5 |\n| --- | --- | --- | --- |\n| Completeness | major gaps | minor gaps | thorough |\n| Accuracy | frequent errors | few errors | verified |\n| Clarity | hard to follow | mostly clear | crisp |",
    },
    {
      id: "procedure",
      title: "Audit Procedure",
      placeholder: "The ordered steps of the audit.",
      defaultContent:
        "1. Collect the artifact and its context.\n2. Score each rubric dimension with a one-line justification.\n3. Sum the scores and map the total to a grade band.\n4. List the highest-impact fixes first.",
    },
    {
      id: "report-format",
      title: "Report Format",
      placeholder: "How to present the score and findings.",
      defaultContent:
        "Report the total score, the per-dimension breakdown, and the top three remediation actions. Cite specific evidence for every deduction.",
    },
  ],
  extraFiles: [],
};

const graduatedCritique: Archetype = {
  id: "graduated-critique",
  title: "Graduated Critique",
  blurb: "Reviews at selectable depths, matching effort to the stakes.",
  dirs: [],
  sections: [
    {
      id: "overview",
      title: "Overview",
      placeholder: "Describe what is critiqued and why graduated depth matters.",
      defaultContent:
        "Describe what this skill critiques and why graduated depth matters. Match review effort to the stakes of the artifact.",
    },
    {
      id: "levels",
      title: "Review Levels",
      placeholder: "The available depths and what each covers.",
      defaultContent:
        "Offer three depths of review:\n\n- Level 1 — Surface: correctness, obvious errors, and blockers only.\n- Level 2 — Structural: organization, completeness, and internal consistency.\n- Level 3 — Deep: assumptions, edge cases, and adversarial failure modes.",
    },
    {
      id: "selecting-level",
      title: "Selecting A Level",
      placeholder: "How to pick the right depth.",
      defaultContent:
        "Choose the shallowest level that meets the request. Escalate only when the artifact is high-stakes or the requester asks for more depth.",
    },
    {
      id: "critique-output",
      title: "Critique Output",
      placeholder: "How findings are grouped and delivered.",
      defaultContent:
        "Group findings by level and severity. Lead with blockers, then improvements, then optional polish. Attach a concrete fix to each finding.",
    },
  ],
  extraFiles: [],
};

const expertPersona: Archetype = {
  id: "expert-persona",
  title: "Expert Persona",
  blurb: "Speaks as a cited domain expert with explicit NOT-for boundaries.",
  dirs: ["references"],
  sections: [
    {
      id: "persona",
      title: "Persona",
      placeholder: "The named expert voice and its credential.",
      defaultContent:
        "Adopt the voice of a named domain expert with a specific point of view. State the credential or tradition the persona draws on. Stay in character while remaining accurate.",
    },
    {
      id: "scope",
      title: "Scope And Boundaries",
      placeholder: "What is in scope, plus explicit NOT-for cases.",
      defaultContent:
        "Answer only questions inside the stated domain.\n\nNOT for: general chit-chat, unrelated domains, or advice that requires a licensed professional. Redirect out-of-scope requests instead of guessing.",
    },
    {
      id: "method",
      title: "Method",
      placeholder: "How the persona reasons and grounds claims.",
      defaultContent:
        "Reason from first principles in the domain, then translate to plain guidance. Ground every claim in the cited sources rather than unstated opinion.",
    },
    {
      id: "sources",
      title: "Sources",
      placeholder: "Point to the cited source material.",
      defaultContent:
        "Base answers on the material catalogued in [sources](references/sources.md). Cite the specific source when making a non-obvious claim.",
    },
  ],
  extraFiles: [
    {
      path: "references/sources.md",
      content:
        "# Sources\n\nList the authoritative works, standards, or datasets this persona relies on. Give each a one-line note on what it authorizes the persona to claim.\n",
    },
  ],
};

const pipelineOrchestrator: Archetype = {
  id: "pipeline-orchestrator",
  title: "Pipeline / Orchestrator",
  blurb: "Routes a multi-step request to focused sub-skills. Advanced.",
  advanced: true,
  dirs: [],
  sections: [
    {
      id: "overview",
      title: "Overview",
      placeholder: "Describe the workflow coordinated and keep this file as the routing layer.",
      defaultContent:
        "Describe the multi-step workflow this skill coordinates. Delegate each step to a focused sub-skill and keep this file as the routing layer only. This archetype is advanced: prefer a single-capability skill unless orchestration is genuinely required.",
    },
    {
      id: "routing-table",
      title: "Routing Table",
      placeholder: "Signals mapped to sub-skills.",
      defaultContent:
        "Route each request to the sub-skill that owns it:\n\n| Signal in request | Route to sub-skill |\n| --- | --- |\n| data cleaning or parsing | data-preparation |\n| chart or dashboard | data-visualization |\n| written summary | report-writing |\n\nMatch the most specific signal first.",
    },
    {
      id: "handoff-contract",
      title: "Handoff Contract",
      placeholder: "What to pass to each sub-skill.",
      defaultContent:
        "Pass a compact brief to each sub-skill: the goal, the inputs, and the expected output shape. Preserve prior results so downstream steps do not re-derive them.",
    },
    {
      id: "fallback",
      title: "Fallback",
      placeholder: "How to handle unroutable requests.",
      defaultContent:
        "Handle requests that match no route by asking one clarifying question, then routing again. Never silently drop a request.",
    },
  ],
  extraFiles: [],
};

export const archetypes: Archetype[] = [
  technique,
  reference,
  documentGenerator,
  styleGuide,
  auditChecklist,
  graduatedCritique,
  expertPersona,
  pipelineOrchestrator,
];

export function getArchetype(id: string | null): Archetype | undefined {
  if (!id) return undefined;
  return archetypes.find((a) => a.id === id);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/wizard/archetypes.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/wizard/archetypes.ts lib/wizard/archetypes.test.ts
git commit -m "feat(wizard): archetype template catalog (8 archetypes)"
```

---

### Task 2: State model, name validation, and the assembler (`lib/wizard/{state,name,assemble}.ts`)

**Files:**
- Create: `lib/wizard/name.ts`
- Create: `lib/wizard/state.ts`
- Create: `lib/wizard/assemble.ts`
- Test: `lib/wizard/name.test.ts`
- Test: `lib/wizard/assemble.test.ts`

**Interfaces:**
- Consumes: `archetypes`, `getArchetype` (Task 1); `SkillFile`, `lintSkill` (Plan 1)
- Produces (the shared shapes the reducer and UI import):

```ts
// name.ts — mirrors engine E02/E03 messages
export interface NameCheck { ok: boolean; message?: string }
export function validateName(name: string): NameCheck;

// state.ts — the single source of truth for wizard state (pure, no React)
export interface WizardIntent { what: string; when: string; output: string; distribution: string }
export interface WizardState {
  step: number; // 1..5
  intent: WizardIntent;
  archetypeId: string | null;
  name: string;
  descWhat: string;
  descWhen: string;
  descTriggers: string;
  descNegative: string;
  category: string;
  license: string;   // "none" | "MIT" | "Apache-2.0" | "Proprietary"
  version: string;
  disableModelInvocation: boolean;
  sections: Record<string, string>; // seeded from the archetype template
}
export const initialWizardState: WizardState;
export function seedSections(archetypeId: string | null): Record<string, string>;
export function buildDescription(
  s: Pick<WizardState, "descWhat" | "descWhen" | "descTriggers" | "descNegative">
): string;
export function canAdvance(s: WizardState): boolean;

// assemble.ts — pure assembler consumed by Step 4 (meter) and Step 5 (export)
export function assembleBody(state: WizardState): string;
export function assembleSkill(state: WizardState): { files: SkillFile[]; dirName: string };
```

- [ ] **Step 1: Write name.ts and its failing tests**

`lib/wizard/name.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { validateName } from "./name";

describe("validateName", () => {
  it("accepts kebab-case names", () => {
    expect(validateName("processing-pdfs")).toEqual({ ok: true });
    expect(validateName("a1")).toEqual({ ok: true });
  });
  it.each([
    ["", /kebab-case/i],
    ["MySkill", /kebab-case/i],
    ["-lead", /kebab-case/i],
    ["a--b", /kebab-case/i],
    ["a_b", /kebab-case/i],
  ])("rejects %s", (name, re) => {
    const r = validateName(name);
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(re);
  });
  it("rejects reserved words with the engine's wording", () => {
    expect(validateName("claude-helper").message).toMatch(/reserved word/i);
    expect(validateName("anthropic-tools").message).toMatch(/reserved word/i);
  });
  it("rejects names over 64 chars", () => {
    expect(validateName("a".repeat(65)).message).toMatch(/64/);
  });
});
```

`lib/wizard/name.ts`:
```ts
const NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export interface NameCheck {
  ok: boolean;
  message?: string;
}

/** Mirrors engine rules E02 (format/length) and E03 (reserved words). */
export function validateName(name: string): NameCheck {
  if (!name) return { ok: false, message: "Add a name in kebab-case, e.g. processing-pdfs." };
  if (name.length > 64) return { ok: false, message: `name is ${name.length} chars (max 64).` };
  if (/(claude|anthropic)/i.test(name)) {
    return { ok: false, message: `"${name}" contains a reserved word (claude/anthropic).` };
  }
  if (!NAME_RE.test(name)) {
    return {
      ok: false,
      message: `"${name}" is not kebab-case — lowercase letters, digits and single hyphens, no leading/trailing hyphen.`,
    };
  }
  return { ok: true };
}
```

- [ ] **Step 2: Write state.ts** (no dedicated test file — its behavior is exercised by the reducer tests in Task 3 and the assembler tests below; `buildDescription`/`canAdvance` are covered there).

`lib/wizard/state.ts`:
```ts
import { getArchetype } from "./archetypes";
import { validateName } from "./name";

export interface WizardIntent {
  what: string;
  when: string;
  output: string;
  distribution: string;
}

export interface WizardState {
  step: number;
  intent: WizardIntent;
  archetypeId: string | null;
  name: string;
  descWhat: string;
  descWhen: string;
  descTriggers: string;
  descNegative: string;
  category: string;
  license: string;
  version: string;
  disableModelInvocation: boolean;
  sections: Record<string, string>;
}

export const initialWizardState: WizardState = {
  step: 1,
  intent: { what: "", when: "", output: "", distribution: "personal" },
  archetypeId: null,
  name: "",
  descWhat: "",
  descWhen: "",
  descTriggers: "",
  descNegative: "",
  category: "",
  license: "none",
  version: "1.0.0",
  disableModelInvocation: false,
  sections: {},
};

/** Seed the per-section editor state from an archetype's default content. */
export function seedSections(archetypeId: string | null): Record<string, string> {
  const a = getArchetype(archetypeId);
  const out: Record<string, string> = {};
  if (a) for (const s of a.sections) out[s.id] = s.defaultContent;
  return out;
}

/** Assemble the description exactly as previewed in Step 3. */
export function buildDescription(
  s: Pick<WizardState, "descWhat" | "descWhen" | "descTriggers" | "descNegative">
): string {
  const base = `${s.descWhat}. Use when ${s.descWhen}. Triggers: ${s.descTriggers}.`;
  return s.descNegative ? `${base} Do not use for ${s.descNegative}.` : base;
}

/** Whether the current step has the minimum input needed to move forward. */
export function canAdvance(s: WizardState): boolean {
  switch (s.step) {
    case 1:
      return s.intent.what.trim() !== "" && s.intent.when.trim() !== "";
    case 2:
      return s.archetypeId !== null;
    case 3:
      return (
        validateName(s.name).ok &&
        s.descWhat.trim() !== "" &&
        s.descWhen.trim() !== "" &&
        s.descTriggers.trim() !== ""
      );
    case 4:
      return true;
    default:
      return false;
  }
}
```

- [ ] **Step 3: Write the failing assembler tests**

`lib/wizard/assemble.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { assembleSkill, assembleBody } from "./assemble";
import { archetypes } from "./archetypes";
import { buildDescription, initialWizardState, seedSections, type WizardState } from "./state";
import { lintSkill } from "@/lib/skill-lint";

function minimalState(archetypeId: string): WizardState {
  return {
    ...initialWizardState,
    step: 5,
    archetypeId,
    name: "demo-skill",
    descWhat: "Produces a demo artifact",
    descWhen: "the user asks for a demo",
    descTriggers: '"make a demo", "demo this"',
    category: "Utility & Automation",
    license: "MIT",
    version: "1.0.0",
    sections: seedSections(archetypeId),
  };
}

describe("buildDescription", () => {
  it("concatenates the three fields and appends the negative clause", () => {
    const s = { ...minimalState("technique"), descNegative: "unrelated tasks" };
    expect(buildDescription(s)).toBe(
      'Produces a demo artifact. Use when the user asks for a demo. Triggers: "make a demo", "demo this". Do not use for unrelated tasks.'
    );
  });
  it("omits the negative clause when empty", () => {
    expect(buildDescription(minimalState("technique"))).toBe(
      'Produces a demo artifact. Use when the user asks for a demo. Triggers: "make a demo", "demo this".'
    );
  });
});

describe("assembleSkill frontmatter", () => {
  it("emits SKILL.md as the first file with dirName equal to name", () => {
    const { files, dirName } = assembleSkill(minimalState("technique"));
    expect(files[0].path).toBe("SKILL.md");
    expect(dirName).toBe("demo-skill");
  });

  it("omits optional fields when unset", () => {
    const s = { ...minimalState("technique"), license: "none", category: "", version: "" };
    const md = assembleSkill(s).files[0].content;
    expect(md).not.toContain("license:");
    expect(md).not.toContain("metadata:");
    expect(md).not.toContain("disable-model-invocation");
  });

  it("includes license, metadata and the disable flag when set", () => {
    const s = { ...minimalState("technique"), disableModelInvocation: true };
    const r = lintSkill(assembleSkill(s).files, { dirName: s.name });
    if (r.kind !== "skill") throw new Error(r.reason);
    const fm = r.skill.frontmatter.data;
    expect(fm["name"]).toBe("demo-skill");
    expect(fm["license"]).toBe("MIT");
    expect(fm["disable-model-invocation"]).toBe(true);
    expect((fm["metadata"] as Record<string, unknown>).version).toBe("1.0.0");
    expect((fm["metadata"] as Record<string, unknown>).category).toBe("Utility & Automation");
  });

  it("includes the archetype's extra files", () => {
    const { files } = assembleSkill(minimalState("reference"));
    const paths = files.map((f) => f.path);
    expect(paths).toContain("references/concepts.md");
    expect(paths).toContain("references/api.md");
  });

  it("assembleBody starts with an H1 title derived from the name", () => {
    expect(assembleBody(minimalState("technique"))).toMatch(/^# Demo Skill\n/);
  });
});

describe("QUALITY GATE: every archetype assembles and lints with zero errors", () => {
  it.each(archetypes.map((a) => a.id))("archetype %s has no error-severity findings", (id) => {
    const { files, dirName } = assembleSkill(minimalState(id));
    const r = lintSkill(files, { dirName });
    if (r.kind !== "skill") throw new Error(`${id}: not-a-skill (${r.reason})`);
    const errors = r.findings.filter((f) => f.severity === "error");
    expect(
      errors,
      `${id} produced errors: ${errors.map((e) => `${e.ruleId} ${e.message}`).join(" | ")}`
    ).toEqual([]);
  });
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `npx vitest run lib/wizard/assemble.test.ts`
Expected: FAIL — "Cannot find module './assemble'".

- [ ] **Step 5: Implement assemble.ts**

> All string frontmatter values are emitted via `JSON.stringify` (a valid YAML double-quoted scalar). This keeps the description's `: ` and embedded quotes safe (no E12 recovery), keeps `version` a string ("1.0.0" not the number 1), and keeps category values containing `&` (e.g. "Data & Analysis") from being misread as YAML anchors. Angle brackets are never introduced by the assembler, so E06 can only fire on user-typed `<`/`>`, which the minimal-valid states avoid.

```ts
import type { SkillFile } from "@/lib/skill-lint";
import { getArchetype } from "./archetypes";
import { buildDescription, type WizardState } from "./state";

/** kebab name -> Title Case for the body H1. */
function titleFromName(name: string): string {
  const title = name
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
  return title || "Skill";
}

/** A YAML double-quoted scalar. JSON string escaping is a valid subset. */
function yamlString(value: string): string {
  return JSON.stringify(value);
}

/** The SKILL.md body: an H1 title followed by one "## {title}" block per section. */
export function assembleBody(state: WizardState): string {
  const archetype = getArchetype(state.archetypeId);
  const blocks = archetype
    ? archetype.sections.map((s) => {
        const content = (state.sections[s.id] ?? s.defaultContent).trim();
        return `## ${s.title}\n\n${content}`;
      })
    : [];
  return [`# ${titleFromName(state.name)}`, ...blocks].join("\n\n");
}

export function assembleSkill(state: WizardState): { files: SkillFile[]; dirName: string } {
  const archetype = getArchetype(state.archetypeId);
  const description = buildDescription(state);

  const fm: string[] = [];
  fm.push(`name: ${yamlString(state.name)}`);
  fm.push(`description: ${yamlString(description)}`);
  if (state.license && state.license !== "none") fm.push(`license: ${yamlString(state.license)}`);
  if (state.disableModelInvocation) fm.push(`disable-model-invocation: true`);

  const meta: string[] = [];
  if (state.version.trim()) meta.push(`  version: ${yamlString(state.version)}`);
  if (state.category.trim()) meta.push(`  category: ${yamlString(state.category)}`);
  if (meta.length > 0) {
    fm.push("metadata:");
    fm.push(...meta);
  }

  const frontmatter = `---\n${fm.join("\n")}\n---\n`;
  const content = `${frontmatter}\n${assembleBody(state)}\n`;

  const files: SkillFile[] = [{ path: "SKILL.md", content }];
  if (archetype) {
    for (const extra of archetype.extraFiles) {
      files.push({ path: extra.path, content: extra.content });
    }
  }
  return { files, dirName: state.name };
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run lib/wizard/name.test.ts lib/wizard/assemble.test.ts`
Expected: PASS — name tests plus assembler tests, including 8 green cases in the QUALITY GATE block.

- [ ] **Step 7: Commit**

```bash
git add lib/wizard/name.ts lib/wizard/name.test.ts lib/wizard/state.ts lib/wizard/assemble.ts lib/wizard/assemble.test.ts
git commit -m "feat(wizard): state model, name validation, and lint-clean assembler"
```

---

### Task 3: Wizard reducer + hook (`components/wizard/useWizard.ts`)

**Files:**
- Create: `components/wizard/useWizard.ts`
- Test: `components/wizard/useWizard.test.ts`

**Interfaces:**
- Consumes: `WizardState`, `initialWizardState`, `seedSections` (Task 2 `state.ts`)
- Produces:

```ts
export type WizardAction =
  | { type: "next" }
  | { type: "back" }
  | { type: "goto"; step: number }
  | { type: "setIntent"; field: keyof WizardState["intent"]; value: string }
  | { type: "selectArchetype"; archetypeId: string }
  | { type: "setText"; field: TextField; value: string }
  | { type: "toggle"; field: "disableModelInvocation"; value: boolean }
  | { type: "setSection"; id: string; value: string };
export function wizardReducer(state: WizardState, action: WizardAction): WizardState;
export function useWizard(): [WizardState, Dispatch<WizardAction>];
```

> The reducer is a pure function exported for tests; the hook is a thin `useReducer` wrapper. `useWizard.test.ts` tests the reducer only (no React render needed), so it needs no jsdom pragma.

- [ ] **Step 1: Write the failing reducer tests**

`components/wizard/useWizard.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { wizardReducer } from "./useWizard";
import { initialWizardState } from "@/lib/wizard/state";
import { getArchetype } from "@/lib/wizard/archetypes";

describe("wizardReducer", () => {
  it("starts at step 1", () => {
    expect(initialWizardState.step).toBe(1);
  });

  it("advances and clamps at step 5", () => {
    let s = initialWizardState;
    for (let i = 0; i < 10; i++) s = wizardReducer(s, { type: "next" });
    expect(s.step).toBe(5);
  });

  it("goes back and clamps at step 1", () => {
    let s = { ...initialWizardState, step: 2 };
    s = wizardReducer(s, { type: "back" });
    s = wizardReducer(s, { type: "back" });
    expect(s.step).toBe(1);
  });

  it("goto clamps into 1..5", () => {
    expect(wizardReducer(initialWizardState, { type: "goto", step: 9 }).step).toBe(5);
    expect(wizardReducer(initialWizardState, { type: "goto", step: 0 }).step).toBe(1);
    expect(wizardReducer(initialWizardState, { type: "goto", step: 3 }).step).toBe(3);
  });

  it("updates nested intent fields immutably", () => {
    const s = wizardReducer(initialWizardState, { type: "setIntent", field: "what", value: "lint skills" });
    expect(s.intent.what).toBe("lint skills");
    expect(s.intent.when).toBe("");
    expect(initialWizardState.intent.what).toBe("");
  });

  it("selectArchetype records the id and seeds every section", () => {
    const s = wizardReducer(initialWizardState, { type: "selectArchetype", archetypeId: "reference" });
    expect(s.archetypeId).toBe("reference");
    const a = getArchetype("reference")!;
    for (const sec of a.sections) {
      expect(s.sections[sec.id]).toBe(sec.defaultContent);
    }
  });

  it("re-seeds sections when the archetype changes", () => {
    let s = wizardReducer(initialWizardState, { type: "selectArchetype", archetypeId: "reference" });
    s = wizardReducer(s, { type: "setSection", id: "overview", value: "edited" });
    s = wizardReducer(s, { type: "selectArchetype", archetypeId: "technique" });
    expect(s.archetypeId).toBe("technique");
    expect(s.sections["overview"]).toBe(getArchetype("technique")!.sections[0].defaultContent);
  });

  it("setText updates a flat string field", () => {
    const s = wizardReducer(initialWizardState, { type: "setText", field: "name", value: "my-skill" });
    expect(s.name).toBe("my-skill");
  });

  it("toggle updates the boolean flag", () => {
    const s = wizardReducer(initialWizardState, { type: "toggle", field: "disableModelInvocation", value: true });
    expect(s.disableModelInvocation).toBe(true);
  });

  it("setSection updates one section without touching others", () => {
    let s = wizardReducer(initialWizardState, { type: "selectArchetype", archetypeId: "technique" });
    s = wizardReducer(s, { type: "setSection", id: "steps", value: "new steps" });
    expect(s.sections["steps"]).toBe("new steps");
    expect(s.sections["overview"]).toBe(getArchetype("technique")!.sections[0].defaultContent);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run components/wizard/useWizard.test.ts`
Expected: FAIL — "Cannot find module './useWizard'".

- [ ] **Step 3: Implement useWizard.ts**

```ts
"use client";

import { useReducer, type Dispatch } from "react";
import { initialWizardState, seedSections, type WizardState } from "@/lib/wizard/state";

type TextField =
  | "name"
  | "descWhat"
  | "descWhen"
  | "descTriggers"
  | "descNegative"
  | "category"
  | "license"
  | "version";

export type WizardAction =
  | { type: "next" }
  | { type: "back" }
  | { type: "goto"; step: number }
  | { type: "setIntent"; field: keyof WizardState["intent"]; value: string }
  | { type: "selectArchetype"; archetypeId: string }
  | { type: "setText"; field: TextField; value: string }
  | { type: "toggle"; field: "disableModelInvocation"; value: boolean }
  | { type: "setSection"; id: string; value: string };

const clampStep = (n: number): number => Math.min(5, Math.max(1, n));

export function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case "next":
      return { ...state, step: clampStep(state.step + 1) };
    case "back":
      return { ...state, step: clampStep(state.step - 1) };
    case "goto":
      return { ...state, step: clampStep(action.step) };
    case "setIntent":
      return { ...state, intent: { ...state.intent, [action.field]: action.value } };
    case "selectArchetype":
      return { ...state, archetypeId: action.archetypeId, sections: seedSections(action.archetypeId) };
    case "setText":
      return { ...state, [action.field]: action.value } as WizardState;
    case "toggle":
      return { ...state, disableModelInvocation: action.value };
    case "setSection":
      return { ...state, sections: { ...state.sections, [action.id]: action.value } };
    default:
      return state;
  }
}

export function useWizard(): [WizardState, Dispatch<WizardAction>] {
  return useReducer(wizardReducer, initialWizardState);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run components/wizard/useWizard.test.ts`
Expected: PASS (11 tests).

- [ ] **Step 5: Commit**

```bash
git add components/wizard/useWizard.ts components/wizard/useWizard.test.ts
git commit -m "feat(wizard): useReducer state machine with exported reducer"
```

---

### Task 4: Steps 1–3 components (Intent, Archetype gallery, Description builder)

**Files:**
- Create: `components/wizard/StepIndicator.tsx`
- Create: `components/wizard/StepIntent.tsx`
- Create: `components/wizard/StepArchetype.tsx`
- Create: `components/wizard/NameField.tsx`
- Create: `components/wizard/StepDescription.tsx`
- Test: `components/wizard/StepDescription.test.tsx`

**Interfaces:**
- Consumes: `WizardState`, `buildDescription` (state.ts); `validateName` (name.ts); `archetypes` (archetypes.ts); `estimateTokens` (engine); `WizardAction` (useWizard)
- Produces: five controlled components, each `({ state, dispatch })`, plus `StepIndicator({ step })` and `NameField({ value, onChange })`.

- [ ] **Step 1: Write StepIndicator.tsx**

```tsx
"use client";

const STEPS = ["Intent", "Archetype", "Description", "Content", "Review"];

export function StepIndicator({ step }: { step: number }) {
  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-2 text-xs">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const state = n === step ? "current" : n < step ? "done" : "todo";
        const badge =
          state === "current"
            ? "border-indigo-400 bg-indigo-500/20 text-indigo-200"
            : state === "done"
              ? "border-emerald-500 bg-emerald-500/20 text-emerald-300"
              : "border-neutral-700 text-neutral-500";
        return (
          <li key={label} className="flex items-center gap-2">
            <span className={`flex h-6 w-6 items-center justify-center rounded-full border ${badge}`}>{n}</span>
            <span className={state === "todo" ? "text-neutral-600" : "text-neutral-200"}>{label}</span>
            {n < STEPS.length && <span className="mx-1 hidden h-px w-6 bg-neutral-700 sm:inline-block" />}
          </li>
        );
      })}
    </ol>
  );
}
```

- [ ] **Step 2: Write StepIntent.tsx**

```tsx
"use client";

import type { Dispatch } from "react";
import type { WizardState } from "@/lib/wizard/state";
import type { WizardAction } from "./useWizard";

const fieldClass =
  "mt-1 w-full rounded border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-indigo-400";

export function StepIntent({ state, dispatch }: { state: WizardState; dispatch: Dispatch<WizardAction> }) {
  const set = (field: keyof WizardState["intent"], value: string) =>
    dispatch({ type: "setIntent", field, value });

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-indigo-500/40 bg-indigo-500/10 p-4 text-sm text-indigo-100">
        <p className="font-medium">One skill = one capability.</p>
        <p className="mt-1 text-indigo-200/80">
          Good: &ldquo;Generate release notes from a changelog.&rdquo; &nbsp;·&nbsp; Bad: &ldquo;Help with
          engineering&rdquo; (too broad — split it into focused skills).
        </p>
      </div>

      <label className="block">
        <span className="text-sm font-medium text-neutral-200">What does this skill enable?</span>
        <textarea
          rows={2}
          className={fieldClass}
          placeholder="Generate spec-compliant release notes from a changelog."
          value={state.intent.what}
          onChange={(e) => set("what", e.target.value)}
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-neutral-200">When should it trigger?</span>
        <textarea
          rows={2}
          className={fieldClass}
          placeholder="A changelog or list of merged PRs needs to become a readable release note."
          value={state.intent.when}
          onChange={(e) => set("when", e.target.value)}
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-neutral-200">Expected output format</span>
        <input
          className={fieldClass}
          placeholder="Markdown document with Highlights / Fixes / Breaking sections."
          value={state.intent.output}
          onChange={(e) => set("output", e.target.value)}
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-neutral-200">Personal or shared?</span>
        <select
          className={fieldClass}
          value={state.intent.distribution}
          onChange={(e) => set("distribution", e.target.value)}
        >
          <option value="personal">Personal — just for my own use</option>
          <option value="shared">Shared — distribute to a team or the community</option>
        </select>
      </label>
    </div>
  );
}
```

- [ ] **Step 3: Write StepArchetype.tsx**

```tsx
"use client";

import type { Dispatch } from "react";
import { archetypes } from "@/lib/wizard/archetypes";
import type { WizardState } from "@/lib/wizard/state";
import type { WizardAction } from "./useWizard";

export function StepArchetype({ state, dispatch }: { state: WizardState; dispatch: Dispatch<WizardAction> }) {
  return (
    <div>
      <p className="mb-4 text-sm text-neutral-400">
        Pick the shape that matches the capability. It seeds the section scaffold on the next steps.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {archetypes.map((a) => {
          const selected = state.archetypeId === a.id;
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => dispatch({ type: "selectArchetype", archetypeId: a.id })}
              className={
                "rounded-lg border p-4 text-left transition " +
                (selected
                  ? "border-indigo-400 bg-indigo-500/10"
                  : "border-neutral-800 bg-neutral-900 hover:border-neutral-600")
              }
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-neutral-100">{a.title}</h3>
                {a.advanced && (
                  <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-medium text-amber-300">
                    Advanced
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-neutral-400">{a.blurb}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Write NameField.tsx**

```tsx
"use client";

import { validateName } from "@/lib/wizard/name";

export function NameField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const check = validateName(value);
  const invalid = value.length > 0 && !check.ok;
  return (
    <div>
      <label className="block text-sm font-medium text-neutral-200">Skill name (kebab-case)</label>
      <input
        data-testid="name-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="processing-pdfs"
        className={
          "mt-1 w-full rounded border bg-neutral-950 px-3 py-2 text-sm text-neutral-100 outline-none " +
          (invalid ? "border-red-500" : "border-neutral-800 focus:border-indigo-400")
        }
      />
      {invalid && (
        <p data-testid="name-error" className="mt-1 text-xs text-red-400">
          {check.message}
        </p>
      )}
      {value.length > 0 && check.ok && <p className="mt-1 text-xs text-emerald-400">Valid name.</p>}
    </div>
  );
}
```

- [ ] **Step 5: Write the failing StepDescription test**

`components/wizard/StepDescription.test.tsx`:
```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { StepDescription } from "./StepDescription";
import { initialWizardState, type WizardState } from "@/lib/wizard/state";

function stateWith(overrides: Partial<WizardState>): WizardState {
  return { ...initialWizardState, ...overrides };
}

describe("StepDescription", () => {
  it("renders the assembled description preview", () => {
    render(
      <StepDescription
        state={stateWith({
          name: "make-demo",
          descWhat: "Produces a demo artifact",
          descWhen: "the user asks for a demo",
          descTriggers: '"make a demo"',
        })}
        dispatch={vi.fn()}
      />
    );
    expect(screen.getByTestId("desc-preview").textContent).toContain(
      'Produces a demo artifact. Use when the user asks for a demo. Triggers: "make a demo".'
    );
  });

  it("shows no long-description warning under 500 chars", () => {
    render(
      <StepDescription
        state={stateWith({ descWhat: "short", descWhen: "x", descTriggers: "y" })}
        dispatch={vi.fn()}
      />
    );
    expect(screen.queryByTestId("desc-warn")).toBeNull();
  });

  it("warns once the description passes 500 chars", () => {
    render(
      <StepDescription
        state={stateWith({ descWhat: "a".repeat(600), descWhen: "x", descTriggers: "y" })}
        dispatch={vi.fn()}
      />
    );
    expect(screen.getByTestId("desc-warn")).toBeTruthy();
  });

  it("flags third-person / second-person phrasing", () => {
    render(
      <StepDescription
        state={stateWith({ descWhat: "you can do things", descWhen: "x", descTriggers: "y" })}
        dispatch={vi.fn()}
      />
    );
    expect(screen.getByTestId("desc-person-hint")).toBeTruthy();
  });
});
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `npx vitest run components/wizard/StepDescription.test.tsx`
Expected: FAIL — "Cannot find module './StepDescription'".

- [ ] **Step 7: Implement StepDescription.tsx**

```tsx
"use client";

import type { Dispatch } from "react";
import { estimateTokens } from "@/lib/skill-lint";
import { buildDescription, type WizardState } from "@/lib/wizard/state";
import type { WizardAction } from "./useWizard";
import { NameField } from "./NameField";

const fieldClass =
  "mt-1 w-full rounded border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-indigo-400";

const PERSON_RE = /\b(I can|you can|you should)\b/i;

export function StepDescription({ state, dispatch }: { state: WizardState; dispatch: Dispatch<WizardAction> }) {
  const set = (field: "descWhat" | "descWhen" | "descTriggers" | "descNegative", value: string) =>
    dispatch({ type: "setText", field, value });

  const description = buildDescription(state);
  const len = description.length;
  const overHard = len > 1024;
  const overWarn = len > 500;
  const hasPerson = PERSON_RE.test(description);

  const counterClass = overHard ? "text-red-400" : overWarn ? "text-amber-400" : "text-neutral-400";

  return (
    <div className="space-y-6">
      <NameField value={state.name} onChange={(v) => dispatch({ type: "setText", field: "name", value: v })} />

      <label className="block">
        <span className="text-sm font-medium text-neutral-200">What it does</span>
        <input
          className={fieldClass}
          placeholder="Generates release notes from a changelog"
          value={state.descWhat}
          onChange={(e) => set("descWhat", e.target.value)}
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-neutral-200">When to use it</span>
        <input
          className={fieldClass}
          placeholder="a changelog or merged-PR list needs a readable release note"
          value={state.descWhen}
          onChange={(e) => set("descWhen", e.target.value)}
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-neutral-200">Concrete trigger phrases (quoted)</span>
        <input
          className={fieldClass}
          placeholder={'"write release notes", "summarize the changelog"'}
          value={state.descTriggers}
          onChange={(e) => set("descTriggers", e.target.value)}
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-neutral-200">Negative triggers (optional)</span>
        <input
          className={fieldClass}
          placeholder="writing marketing copy or blog posts"
          value={state.descNegative}
          onChange={(e) => set("descNegative", e.target.value)}
        />
      </label>

      <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-neutral-300">Assembled description</span>
          <span className="flex gap-3">
            <span data-testid="desc-char-counter" className={counterClass}>
              {len}/1024 chars
            </span>
            <span className="text-neutral-500">~{estimateTokens(description)} tokens</span>
          </span>
        </div>
        <p data-testid="desc-preview" className="mt-2 text-sm text-neutral-200">
          {description}
        </p>
        {overWarn && !overHard && (
          <p data-testid="desc-warn" className="mt-2 text-xs text-amber-400">
            Long descriptions dilute triggering — aim for under 500 characters.
          </p>
        )}
        {overHard && (
          <p data-testid="desc-error" className="mt-2 text-xs text-red-400">
            Over the 1024-character hard limit — the skill will be rejected. Trim it.
          </p>
        )}
        {hasPerson && (
          <p data-testid="desc-person-hint" className="mt-2 text-xs text-amber-400">
            Prefer third-person, imperative phrasing over &ldquo;I can&rdquo; / &ldquo;you can&rdquo;.
          </p>
        )}
      </div>

      <div className="rounded-lg border border-neutral-800 bg-neutral-950 p-4">
        <p className="text-xs font-medium text-neutral-400">How the agent sees it</p>
        <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded bg-black/40 p-3 text-xs text-neutral-300">
{`name: ${state.name || "your-skill-name"}
description: ${description}`}
        </pre>
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `npx vitest run components/wizard/StepDescription.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 9: Commit**

```bash
git add components/wizard/StepIndicator.tsx components/wizard/StepIntent.tsx components/wizard/StepArchetype.tsx components/wizard/NameField.tsx components/wizard/StepDescription.tsx components/wizard/StepDescription.test.tsx
git commit -m "feat(wizard): steps 1-3 (intent, archetype gallery, description builder)"
```

---

### Task 5: Steps 4–5, page assembly, export gate, handoff, and full verification

**Files:**
- Create: `components/wizard/StepContent.tsx`
- Create: `components/wizard/StepReview.tsx`
- Create: `app/new/page.tsx`
- Test: `components/wizard/StepContent.test.tsx`
- Test: `components/wizard/StepReview.test.tsx`

**Interfaces:**
- Consumes: everything above; `assembleSkill`, `assembleBody` (assemble.ts); `estimateTokens`, `lintSkill` (engine); `stashIncomingSkill` (`@/lib/handoff`); `zipSkill`, `downloadBlob` (`@/lib/zip`); `useRouter` from `next/navigation`
- Produces: the mounted route `/new`.

- [ ] **Step 1: Write StepContent.tsx**

```tsx
"use client";

import type { Dispatch } from "react";
import { estimateTokens } from "@/lib/skill-lint";
import { getArchetype } from "@/lib/wizard/archetypes";
import { assembleBody, type WizardState } from "@/lib/wizard/assemble";
import type { WizardAction } from "./useWizard";

const CATEGORIES = [
  "Development & Code Tools",
  "Data & Analysis",
  "Document Processing",
  "Creative & Design",
  "Writing & Research",
  "Learning & Knowledge",
  "Media & Content",
  "Collaboration & PM",
  "Marketing & SEO",
  "Career",
  "Security & Testing",
  "Utility & Automation",
  "Meta/Context Engineering",
];
const LICENSES = ["none", "MIT", "Apache-2.0", "Proprietary"];

const fieldClass =
  "mt-1 w-full rounded border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-indigo-400";

export function StepContent({ state, dispatch }: { state: WizardState; dispatch: Dispatch<WizardAction> }) {
  const archetype = getArchetype(state.archetypeId);
  const body = assembleBody(state);
  const lines = body.split("\n").length;
  const words = body.split(/\s+/).filter(Boolean).length;
  const tokens = estimateTokens(body);

  return (
    <div className="space-y-6">
      {archetype?.sections.map((s) => (
        <label key={s.id} className="block">
          <span className="text-sm font-medium text-neutral-200">{s.title}</span>
          <textarea
            rows={5}
            className={`${fieldClass} font-mono`}
            placeholder={s.placeholder}
            value={state.sections[s.id] ?? ""}
            onChange={(e) => dispatch({ type: "setSection", id: s.id, value: e.target.value })}
          />
        </label>
      ))}

      <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4 text-xs">
        <div className="flex flex-wrap gap-4 text-neutral-400">
          <span data-testid="body-lines">{lines} lines</span>
          <span>{words} words</span>
          <span>~{tokens} tokens</span>
        </div>
        {lines > 400 && (
          <p data-testid="body-warn" className="mt-2 text-amber-400">
            The body is over 400 lines — move detail into references/ so it loads only when needed.
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium text-neutral-200">Category</span>
          <select
            className={fieldClass}
            value={state.category}
            onChange={(e) => dispatch({ type: "setText", field: "category", value: e.target.value })}
          >
            <option value="">None</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-medium text-neutral-200">License</span>
          <select
            className={fieldClass}
            value={state.license}
            onChange={(e) => dispatch({ type: "setText", field: "license", value: e.target.value })}
          >
            {LICENSES.map((l) => (
              <option key={l} value={l}>
                {l === "none" ? "None" : l}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-medium text-neutral-200">Version</span>
          <input
            className={fieldClass}
            value={state.version}
            onChange={(e) => dispatch({ type: "setText", field: "version", value: e.target.value })}
          />
        </label>

        <label className="flex items-center gap-2 self-end pb-2">
          <input
            type="checkbox"
            checked={state.disableModelInvocation}
            onChange={(e) => dispatch({ type: "toggle", field: "disableModelInvocation", value: e.target.checked })}
          />
          <span className="text-sm text-neutral-200">User-invoked only (disable-model-invocation)</span>
        </label>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write StepReview.tsx**

```tsx
"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { lintSkill } from "@/lib/skill-lint";
import { assembleSkill } from "@/lib/wizard/assemble";
import type { WizardState } from "@/lib/wizard/state";
import { stashIncomingSkill } from "@/lib/handoff";
import { zipSkill, downloadBlob } from "@/lib/zip";

const SEVERITY_COLOR: Record<string, string> = {
  error: "text-red-400",
  warning: "text-amber-400",
  suggestion: "text-neutral-400",
};

export function StepReview({ state }: { state: WizardState }) {
  const router = useRouter();
  const { files, dirName } = useMemo(() => assembleSkill(state), [state]);
  const outcome = useMemo(() => lintSkill(files, { dirName }), [files, dirName]);

  const findings = outcome.kind === "skill" ? outcome.findings : [];
  const errors = findings.filter((f) => f.severity === "error");
  const score = outcome.kind === "skill" ? outcome.score : null;

  function openInWorkspace() {
    stashIncomingSkill(files, { dirName, source: "wizard" });
    router.push("/workspace");
  }

  function download() {
    const bytes = zipSkill(files, dirName);
    downloadBlob(`${dirName}.zip`, bytes, "application/zip");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-900 p-4">
        <div>
          <p className="text-sm text-neutral-400">Lint score</p>
          <p className="text-2xl font-semibold text-neutral-100">
            {score ? `${score.value}/100` : "—"}
            {score && <span className="ml-2 text-sm font-normal text-neutral-400">{score.band}</span>}
          </p>
        </div>
        <div className="text-right text-xs text-neutral-400">
          <p>{files.length} file(s)</p>
          <p>{dirName || "unnamed"}/</p>
        </div>
      </div>

      <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
        <p className="mb-2 text-sm font-medium text-neutral-300">Findings</p>
        {findings.length === 0 ? (
          <p className="text-sm text-emerald-400">No findings — the skill is clean.</p>
        ) : (
          <ul className="space-y-2 text-xs">
            {findings.map((f, i) => (
              <li key={`${f.ruleId}-${i}`} className="flex gap-2">
                <span className={`font-mono ${SEVERITY_COLOR[f.severity]}`}>{f.ruleId}</span>
                <span className="text-neutral-300">{f.message}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={openInWorkspace}
          className="rounded bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-400"
        >
          Open in Workspace
        </button>
        <button
          type="button"
          onClick={download}
          disabled={errors.length > 0}
          data-testid="download-zip"
          className="rounded border border-neutral-700 px-4 py-2 text-sm font-medium text-neutral-100 hover:border-neutral-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Download .zip
        </button>
        {errors.length > 0 && (
          <p className="w-full text-xs text-red-400">
            Fix the {errors.length} error finding(s) to enable download. You can still open the draft in the
            workspace to iterate.
          </p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Write app/new/page.tsx**

```tsx
"use client";

import { useWizard } from "@/components/wizard/useWizard";
import { StepIndicator } from "@/components/wizard/StepIndicator";
import { StepIntent } from "@/components/wizard/StepIntent";
import { StepArchetype } from "@/components/wizard/StepArchetype";
import { StepDescription } from "@/components/wizard/StepDescription";
import { StepContent } from "@/components/wizard/StepContent";
import { StepReview } from "@/components/wizard/StepReview";
import { canAdvance } from "@/lib/wizard/state";

export default function NewSkillPage() {
  const [state, dispatch] = useWizard();

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 text-neutral-100">
      <h1 className="text-xl font-semibold">Create a skill</h1>
      <p className="mt-1 text-sm text-neutral-400">
        Answer a few questions and Skillsmith assembles a spec-compliant skill.
      </p>

      <div className="mt-6">
        <StepIndicator step={state.step} />
      </div>

      <div className="mt-8">
        {state.step === 1 && <StepIntent state={state} dispatch={dispatch} />}
        {state.step === 2 && <StepArchetype state={state} dispatch={dispatch} />}
        {state.step === 3 && <StepDescription state={state} dispatch={dispatch} />}
        {state.step === 4 && <StepContent state={state} dispatch={dispatch} />}
        {state.step === 5 && <StepReview state={state} />}
      </div>

      <div className="mt-10 flex items-center justify-between border-t border-neutral-800 pt-6">
        <button
          type="button"
          onClick={() => dispatch({ type: "back" })}
          disabled={state.step === 1}
          className="rounded border border-neutral-700 px-4 py-2 text-sm text-neutral-200 hover:border-neutral-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Back
        </button>
        {state.step < 5 && (
          <button
            type="button"
            onClick={() => dispatch({ type: "next" })}
            disabled={!canAdvance(state)}
            className="rounded bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
          </button>
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Write the failing component tests**

`components/wizard/StepContent.test.tsx`:
```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { StepContent } from "./StepContent";
import { initialWizardState, seedSections, type WizardState } from "@/lib/wizard/state";

function state(archetypeId: string, overrides: Partial<WizardState> = {}): WizardState {
  return { ...initialWizardState, archetypeId, sections: seedSections(archetypeId), name: "demo", ...overrides };
}

describe("StepContent", () => {
  it("renders one textarea per archetype section and a live meter", () => {
    render(<StepContent state={state("technique")} dispatch={vi.fn()} />);
    expect(screen.getByTestId("body-lines").textContent).toMatch(/\d+ lines/);
    expect(screen.queryByTestId("body-warn")).toBeNull();
  });

  it("warns when the assembled body exceeds 400 lines", () => {
    const big = state("technique");
    big.sections = { ...big.sections, overview: "line\n".repeat(500) };
    render(<StepContent state={big} dispatch={vi.fn()} />);
    expect(screen.getByTestId("body-warn")).toBeTruthy();
  });
});
```

`components/wizard/StepReview.test.tsx`:
```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const { push, stash, zip, download } = vi.hoisted(() => ({
  push: vi.fn(),
  stash: vi.fn(),
  zip: vi.fn(),
  download: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/lib/handoff", () => ({ stashIncomingSkill: stash }));
vi.mock("@/lib/zip", () => ({
  zipSkill: zip.mockReturnValue(new Uint8Array([1])),
  downloadBlob: download,
}));

import { StepReview } from "./StepReview";
import { initialWizardState, seedSections, type WizardState } from "@/lib/wizard/state";

function validState(): WizardState {
  return {
    ...initialWizardState,
    step: 5,
    archetypeId: "technique",
    name: "demo-skill",
    descWhat: "Produces a demo artifact",
    descWhen: "the user asks for a demo",
    descTriggers: '"make a demo"',
    sections: seedSections("technique"),
  };
}

describe("StepReview export gate", () => {
  beforeEach(() => {
    push.mockClear();
    stash.mockClear();
    download.mockClear();
  });

  it("enables download for a clean skill and stashes + routes on Open in Workspace", () => {
    render(<StepReview state={validState()} />);
    const dl = screen.getByTestId("download-zip") as HTMLButtonElement;
    expect(dl.disabled).toBe(false);

    fireEvent.click(screen.getByText("Open in Workspace"));
    expect(stash).toHaveBeenCalledTimes(1);
    const [files, opts] = stash.mock.calls[0];
    expect(files[0].path).toBe("SKILL.md");
    expect(opts).toMatchObject({ dirName: "demo-skill", source: "wizard" });
    expect(push).toHaveBeenCalledWith("/workspace");
  });

  it("disables download when the skill has an error finding (empty name -> E02)", () => {
    render(<StepReview state={{ ...validState(), name: "" }} />);
    const dl = screen.getByTestId("download-zip") as HTMLButtonElement;
    expect(dl.disabled).toBe(true);
  });
});
```

- [ ] **Step 5: Run the new tests to verify they pass**

Run: `npx vitest run components/wizard/StepContent.test.tsx components/wizard/StepReview.test.tsx`
Expected: PASS. (The components were written in Steps 1–3; these are red only until those files exist — write tests, run once to see failures if authored first, then green.)

- [ ] **Step 6: Run the full suite**

Run: `npm test`
Expected: PASS — all wizard tests (archetypes, name, assemble incl. the 8-archetype gate, useWizard, StepDescription, StepContent, StepReview) plus the Plan 1–3 suites stay green.

- [ ] **Step 7: Verify the static build includes /new**

Run: `npm run build`
Expected: build succeeds; `out/new/index.html` exists (verify with `ls out/new/index.html`).

- [ ] **Step 8: Commit**

```bash
git add components/wizard/StepContent.tsx components/wizard/StepReview.tsx app/new/page.tsx components/wizard/StepContent.test.tsx components/wizard/StepReview.test.tsx
git commit -m "feat(wizard): steps 4-5, /new route, export gate and workspace handoff"
```

---

## Self-Review (run after writing, before handoff)

1. **Spec coverage (§8):** Step 1 Intent = 4 inputs + one-skill-one-capability nudge (Task 4 `StepIntent`); Step 2 Archetype = 8-card gallery with the advanced badge (Task 1 catalog + Task 4 `StepArchetype`); Step 3 Description builder = 3 fields + optional negative, live char/token counters, third/second-person hint, "how the agent sees it" preview (Task 4 `StepDescription`); Step 4 Content = per-section editors, line/word/token meter, >400-line hint, category(13)/license/version/disable-model-invocation extras (Task 5 `StepContent`); Step 5 Review & export = real `lintSkill`, score, findings, export gate (Task 5 `StepReview`). Name field with kebab + reserved-word validation lives in the Step 3 header (`NameField`).
2. **Quality gate:** Task 2 Step 6 runs `assembleSkill → lintSkill` for all 8 archetypes and asserts zero error-severity findings. This is the load-bearing test and is stated explicitly.
3. **E06 / YAML safety:** the assembler never emits `<`/`>`; templates contain none (Task 1 test asserts no second person; angle brackets are absent by construction). All string frontmatter values go through `JSON.stringify`, so `: ` (E12), `&` in category values, and quotes in triggers are quoted, and `version` stays a string.
4. **E09 safety:** only `reference` (`references/concepts.md`, `references/api.md`) and `expert-persona` (`references/sources.md`) emit body links, each matched by an `extraFiles` entry; the `document-generator` template's path-like tokens sit inside a fenced code block (parser excludes fenced content from links); `pipeline-orchestrator` routes to bare sub-skill names (no slash → no link).
5. **E04 safety:** `assembleSkill` returns `dirName === state.name`, and every review/assemble call passes that `dirName` to `lintSkill`, so name-vs-folder never mismatches.
6. **Contract fidelity:** `stashIncomingSkill(files, { dirName, source: "wizard" })` and `router.push("/workspace")` match the handoff contract; `zipSkill(files, dirName)` returns `Uint8Array` and `downloadBlob(\`${dirName}.zip\`, bytes, "application/zip")` match the zip contract; both are consumed, never redefined. No nav is added (SiteHeader is in the layout).
7. **Placeholder scan:** none — every step carries complete code, full TSX, or an exact command. All eight archetypes have complete, well-formed default content.
8. **Type flow:** `WizardState`/`buildDescription`/`seedSections`/`canAdvance` produced in Task 2 (`state.ts`), consumed by Tasks 3–5; `WizardAction`/`wizardReducer` produced in Task 3, consumed by Tasks 4–5; `assembleSkill`/`assembleBody` produced in Task 2, consumed by Task 5. `lib/wizard/*` imports only pure modules (engine + own files), never React.
```