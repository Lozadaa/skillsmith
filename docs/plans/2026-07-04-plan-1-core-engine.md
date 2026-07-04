# Skillsmith Plan 1: Core Engine (`lib/skill-lint`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Project scaffold (Next.js static export) plus the pure-TypeScript lint engine: tolerant parser, rule engine with the 12 error rules (E01–E12), token estimator, score, and autofix.

**Architecture:** `lib/skill-lint` is a UI-free TypeScript package inside the Next.js repo, tested with Vitest. A tolerant parser turns raw files into a `ParsedSkill` (it never throws — bad input produces findings, not crashes). Rules are pure functions `(skill, ctx) => Finding[]` registered in a catalog and filtered by profile. Spec: `docs/specs/2026-07-04-skillsmith-design.md`.

**Tech Stack:** Next.js 15 (static export) + React 19 + Tailwind 4, TypeScript strict, Vitest 3, `yaml` 2.x. Node 20+. npm.

**Roadmap context:** This is Plan 1 of 5. Plan 2 = rules W01–W21/S01–S15; Plan 3 = workspace UI + export; Plan 4 = wizard; Plan 5 = GitHub importer.

## Global Constraints

- 100% static: `output: 'export'` in next.config — no server code, no API routes, ever.
- Nothing under `lib/skill-lint/` may import React, Next.js, or anything UI — pure TS + `yaml` only.
- The parser NEVER throws on arbitrary input: every input yields `{ kind: 'skill' } | { kind: 'not-a-skill' }`.
- All `SkillFile.path` values use forward slashes, relative to the skill folder (`SKILL.md`, `references/api.md`).
- Every `Finding` carries `message` (what), `why` (why it matters), `howToFix` — no empty strings.
- Spec hard limits (source: official `quick_validate.py`): name ≤ 64 chars kebab-case; description ≤ 1024 chars, no `<`/`>`; compatibility ≤ 500 chars.
- UI copy in English. Code comments in English.
- Run all commands from repo root `C:\Users\richa\projects\skillsmith`.

---

### Task 1: Project scaffold (Next.js static export + Vitest)

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `.gitignore`
- Create: `app/layout.tsx`, `app/page.tsx`, `app/globals.css`
- Create: `vitest.config.ts`, `lib/skill-lint/smoke.test.ts`

**Interfaces:**
- Consumes: nothing (first task)
- Produces: working `npm run build` (static export to `out/`) and `npm test` (Vitest) for all later tasks

- [ ] **Step 1: Write config and app files**

`package.json`:
```json
{
  "name": "skillsmith",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "next": "^15.3.0",
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "yaml": "^2.8.0"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4.1.0",
    "@types/node": "^22.0.0",
    "@types/react": "^19.1.0",
    "@types/react-dom": "^19.1.0",
    "tailwindcss": "^4.1.0",
    "typescript": "^5.8.0",
    "vitest": "^3.2.0"
  }
}
```

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules", "out"]
}
```

`next.config.ts`:
```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
};

export default nextConfig;
```

`postcss.config.mjs`:
```js
export default { plugins: { "@tailwindcss/postcss": {} } };
```

`.gitignore`:
```
node_modules/
.next/
out/
*.tsbuildinfo
next-env.d.ts
```

`app/globals.css`:
```css
@import "tailwindcss";
```

`app/layout.tsx`:
```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Skillsmith",
  description: "Create, analyze and improve Claude Agent Skills",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

`app/page.tsx`:
```tsx
export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <h1 className="text-3xl font-bold">Skillsmith</h1>
    </main>
  );
}
```

`vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["lib/**/*.test.ts"],
  },
});
```

`lib/skill-lint/smoke.test.ts`:
```ts
import { describe, it, expect } from "vitest";

describe("vitest wiring", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 2: Install and verify test runner**

Run: `npm install` then `npm test`
Expected: 1 test file, 1 passed.

- [ ] **Step 3: Verify static export build**

Run: `npm run build`
Expected: build succeeds; `out/index.html` exists (verify with `ls out/index.html`).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js static export + Vitest"
```

---

### Task 2: Data model + token estimator

**Files:**
- Create: `lib/skill-lint/model.ts`
- Create: `lib/skill-lint/tokens.ts`
- Test: `lib/skill-lint/tokens.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces (used by ALL later tasks — exact shapes):

```ts
// model.ts — the complete file, all types the engine shares
export type Severity = "error" | "warning" | "suggestion";
export type Profile = "generic" | "claude-code-plugin";

export interface SkillFile {
  /** Relative to the skill folder, forward slashes: "SKILL.md", "references/api.md" */
  path: string;
  content: string;
  /** true when the source (e.g. GitHub git mode 120000) marked this as a symlink */
  symlink?: boolean;
}

export interface KeyOccurrence {
  key: string; // original casing as written
  line: number; // 1-based line within SKILL.md
}

export interface Frontmatter {
  raw: string; // YAML block without the --- delimiters
  data: Record<string, unknown>; // parsed, last occurrence wins
  keyOccurrences: KeyOccurrence[];
  parseError?: { message: string; line?: number };
  /** true when the tolerant re-parse (quote unquoted colons) succeeded */
  recovered?: boolean;
  /** the repaired YAML block, present only when recovered */
  fixedRaw?: string;
}

export interface Heading {
  depth: number;
  text: string;
  line: number;
}

export interface LinkRef {
  target: string;
  line: number;
  kind: "link" | "path"; // markdown link vs backtick path
}

export interface SkillBody {
  raw: string;
  lines: string[];
  /** lines outside fenced code blocks */
  proseLines: { text: string; line: number }[];
  headings: Heading[];
  links: LinkRef[];
  wordCount: number;
}

export interface ParsedSkill {
  /** folder containing SKILL.md when known (import/upload); undefined for pasted text */
  dirName?: string;
  /** the SKILL.md filename exactly as provided (detects skill.md / Skill.md) */
  filenameAsGiven: string;
  skillFile: SkillFile;
  frontmatter: Frontmatter;
  body: SkillBody;
  files: SkillFile[]; // every file incl. SKILL.md
}

export type ParseOutcome =
  | { kind: "skill"; skill: ParsedSkill }
  | { kind: "not-a-skill"; reason: string };

export interface AutoFix {
  label: string;
  apply(files: SkillFile[]): SkillFile[];
}

export interface Finding {
  ruleId: string;
  severity: Severity;
  message: string;
  why: string;
  howToFix: string;
  file?: string; // defaults to SKILL.md
  line?: number; // 1-based
  fix?: AutoFix;
}

export interface RuleContext {
  profile: Profile;
}

export interface Rule {
  id: string;
  severity: Severity;
  /** undefined = applies to all profiles */
  profiles?: Profile[];
  check(skill: ParsedSkill, ctx: RuleContext): Finding[];
}

export interface TokenReport {
  /** name + description: loaded into EVERY conversation */
  metadata: number;
  /** SKILL.md body: loaded when the skill triggers */
  body: number;
  /** other .md files: zero cost until the agent reads them */
  references: number;
  /** count of files under scripts/ — executed, never loaded */
  scriptFiles: number;
  total: number; // metadata + body + references
}

export interface ScoreResult {
  value: number; // 0-100
  band: "excellent" | "good" | "needs-work" | "poor";
}
```

```ts
// tokens.ts signatures
export function estimateTokens(text: string): number;
export function tokenReport(skill: ParsedSkill): TokenReport;
```

- [ ] **Step 1: Write model.ts** exactly as shown in Interfaces above (it is pure types — no test needed).

- [ ] **Step 2: Write the failing tests for tokens**

`lib/skill-lint/tokens.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { estimateTokens, tokenReport } from "./tokens";
import type { ParsedSkill } from "./model";

describe("estimateTokens", () => {
  it("returns 0 for empty text", () => {
    expect(estimateTokens("")).toBe(0);
  });

  it("estimates ~chars/3.5 for ASCII text", () => {
    const text = "a".repeat(350);
    expect(estimateTokens(text)).toBe(100);
  });

  it("counts CJK characters as ~1 token each", () => {
    // 10 CJK chars ≈ 10 tokens (vs 10/3.5 ≈ 3 if treated as ASCII)
    expect(estimateTokens("研究深度研究文獻回顧檢索")).toBeGreaterThanOrEqual(10);
  });
});

describe("tokenReport", () => {
  const skill = {
    dirName: "demo",
    filenameAsGiven: "SKILL.md",
    skillFile: { path: "SKILL.md", content: "" },
    frontmatter: {
      raw: "",
      data: { name: "demo-skill", description: "Use when testing token math" },
      keyOccurrences: [],
    },
    body: {
      raw: "Body text here with several words in it",
      lines: [],
      proseLines: [],
      headings: [],
      links: [],
      wordCount: 8,
    },
    files: [
      { path: "SKILL.md", content: "" },
      { path: "references/api.md", content: "reference content ".repeat(50) },
      { path: "scripts/run.py", content: "print('hi')" },
    ],
  } as unknown as ParsedSkill;

  it("splits metadata / body / references and counts script files", () => {
    const r = tokenReport(skill);
    expect(r.metadata).toBeGreaterThan(0);
    expect(r.body).toBeGreaterThan(0);
    expect(r.references).toBeGreaterThan(0);
    expect(r.scriptFiles).toBe(1);
    expect(r.total).toBe(r.metadata + r.body + r.references);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run lib/skill-lint/tokens.test.ts`
Expected: FAIL — "Cannot find module './tokens'".

- [ ] **Step 4: Implement tokens.ts**

```ts
import type { ParsedSkill, TokenReport } from "./model";

const CJK_RE = /[　-鿿豈-﫿가-힯]/g;
const CHARS_PER_TOKEN = 3.5;

/** Heuristic estimate — Anthropic does not publish the Claude 3+ tokenizer. */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  const cjk = text.match(CJK_RE)?.length ?? 0;
  const rest = text.length - cjk;
  return Math.ceil(rest / CHARS_PER_TOKEN + cjk);
}

export function tokenReport(skill: ParsedSkill): TokenReport {
  const name = typeof skill.frontmatter.data["name"] === "string" ? (skill.frontmatter.data["name"] as string) : "";
  const description =
    typeof skill.frontmatter.data["description"] === "string" ? (skill.frontmatter.data["description"] as string) : "";
  const metadata = estimateTokens(name) + estimateTokens(description);
  const body = estimateTokens(skill.body.raw);
  const references = skill.files
    .filter((f) => f.path !== skill.skillFile.path && f.path.toLowerCase().endsWith(".md"))
    .reduce((sum, f) => sum + estimateTokens(f.content), 0);
  const scriptFiles = skill.files.filter((f) => f.path.startsWith("scripts/")).length;
  return { metadata, body, references, scriptFiles, total: metadata + body + references };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run lib/skill-lint/tokens.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add lib/skill-lint/model.ts lib/skill-lint/tokens.ts lib/skill-lint/tokens.test.ts
git commit -m "feat(engine): data model and token estimator"
```

---

### Task 3: Tolerant frontmatter parser

**Files:**
- Create: `lib/skill-lint/parser/frontmatter.ts`
- Test: `lib/skill-lint/parser/frontmatter.test.ts`

**Interfaces:**
- Consumes: `Frontmatter`, `KeyOccurrence` from `../model`
- Produces:

```ts
export interface ExtractResult {
  frontmatter: Frontmatter;
  bodyRaw: string;
  bodyStartLine: number; // 1-based line where the body begins in SKILL.md
}
/** null when the content does not start with --- on line 1 (not a skill) */
export function extractFrontmatter(content: string): ExtractResult | null;
```

- [ ] **Step 1: Write the failing tests**

`lib/skill-lint/parser/frontmatter.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { extractFrontmatter } from "./frontmatter";

describe("extractFrontmatter", () => {
  it("parses a simple valid frontmatter", () => {
    const r = extractFrontmatter(`---\nname: my-skill\ndescription: Use when testing\n---\n# Body\n`);
    expect(r).not.toBeNull();
    expect(r!.frontmatter.data).toEqual({ name: "my-skill", description: "Use when testing" });
    expect(r!.frontmatter.parseError).toBeUndefined();
    expect(r!.bodyRaw).toBe("# Body\n");
    expect(r!.bodyStartLine).toBe(5);
  });

  it("returns null when line 1 is not ---", () => {
    expect(extractFrontmatter("# Just markdown\n")).toBeNull();
    expect(extractFrontmatter("name: no-delimiters\n")).toBeNull();
  });

  it("handles a BOM before ---", () => {
    const r = extractFrontmatter(`﻿---\nname: bom-skill\ndescription: x\n---\nbody`);
    expect(r).not.toBeNull();
    expect(r!.frontmatter.data["name"]).toBe("bom-skill");
  });

  it("parses block scalar descriptions", () => {
    const r = extractFrontmatter(`---\nname: multi\ndescription: |\n  Line one.\n  Line two.\n---\nbody`);
    expect(r!.frontmatter.data["description"]).toBe("Line one.\nLine two.\n");
  });

  it("reports unclosed frontmatter as parseError", () => {
    const r = extractFrontmatter(`---\nname: broken\ndescription: never closed\n`);
    expect(r).not.toBeNull();
    expect(r!.frontmatter.parseError?.message).toMatch(/unclosed/i);
  });

  it("recovers from unquoted colon-space in description (real-world ~1% failure)", () => {
    // Reproduces the verified failure from boraoztunc/adversarial-review
    const r = extractFrontmatter(
      `---\nname: adversarial-review\ndescription: Unlike normal code review: it leads with attacks\n---\nbody`
    );
    expect(r!.frontmatter.recovered).toBe(true);
    expect(r!.frontmatter.data["description"]).toBe("Unlike normal code review: it leads with attacks");
    expect(r!.frontmatter.fixedRaw).toContain('"Unlike normal code review: it leads with attacks"');
  });

  it("records duplicate keys with mixed case, last wins", () => {
    // Reproduces alirezarezvani/claude-coach: Name: + name:
    const r = extractFrontmatter(`---\nName: claude-coach\nname: claude-coach\ndescription: x\n---\nbody`);
    const keys = r!.frontmatter.keyOccurrences.map((k) => k.key);
    expect(keys).toContain("Name");
    expect(keys).toContain("name");
    expect(r!.frontmatter.data["name"]).toBe("claude-coach");
  });

  it("reports non-mapping frontmatter as parseError, never throws", () => {
    const r = extractFrontmatter(`---\njust a scalar\n---\nbody`);
    expect(r!.frontmatter.parseError?.message).toMatch(/mapping/i);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/skill-lint/parser/frontmatter.test.ts`
Expected: FAIL — "Cannot find module './frontmatter'".

- [ ] **Step 3: Implement frontmatter.ts**

```ts
import { parseDocument, isMap, isScalar } from "yaml";
import type { Frontmatter, KeyOccurrence } from "../model";

export interface ExtractResult {
  frontmatter: Frontmatter;
  bodyRaw: string;
  bodyStartLine: number;
}

export function extractFrontmatter(content: string): ExtractResult | null {
  const src = content.replace(/^﻿/, "");
  const lines = src.split("\n");
  if (lines[0]?.trim() !== "---") return null;

  const closing = lines.findIndex((l, i) => i > 0 && l.trim() === "---");
  if (closing === -1) {
    return {
      frontmatter: {
        raw: lines.slice(1).join("\n"),
        data: {},
        keyOccurrences: [],
        parseError: { message: "Unclosed frontmatter: no closing --- found", line: 1 },
      },
      bodyRaw: "",
      bodyStartLine: lines.length + 1,
    };
  }

  const raw = lines.slice(1, closing).join("\n");
  const frontmatter = parseYamlTolerant(raw);
  return {
    frontmatter,
    bodyRaw: lines.slice(closing + 1).join("\n"),
    bodyStartLine: closing + 2,
  };
}

function parseYamlTolerant(raw: string): Frontmatter {
  const first = tryParse(raw);
  if (first) return { raw, ...first };

  // Recovery: quote plain-scalar values that contain ": " (breaks YAML mappings).
  const fixedRaw = raw
    .split("\n")
    .map((line) => {
      const m = /^([A-Za-z][\w-]*):\s+(.*)$/.exec(line);
      if (m && m[2].includes(": ") && !/^["'|>&[{]/.test(m[2].trim())) {
        return `${m[1]}: ${JSON.stringify(m[2])}`;
      }
      return line;
    })
    .join("\n");

  if (fixedRaw !== raw) {
    const second = tryParse(fixedRaw);
    if (second && !second.parseError) {
      return { raw, ...second, recovered: true, fixedRaw };
    }
  }

  // Unrecoverable: report the original error, keep data empty.
  const doc = parseDocument(raw, { uniqueKeys: false });
  const err = doc.errors[0];
  return {
    raw,
    data: {},
    keyOccurrences: [],
    parseError: {
      message: err ? err.message.split("\n")[0] : "Invalid YAML frontmatter",
      line: err ? offsetToLine(raw, err.pos[0]) + 1 : undefined,
    },
  };
}

type ParsedYaml = Pick<Frontmatter, "data" | "keyOccurrences" | "parseError">;

function tryParse(raw: string): ParsedYaml | null {
  const doc = parseDocument(raw, { uniqueKeys: false });
  if (doc.errors.length > 0) return null;
  if (!isMap(doc.contents)) {
    return {
      data: {},
      keyOccurrences: [],
      parseError: { message: "Frontmatter is not a YAML mapping (key: value pairs expected)" },
    };
  }
  const data: Record<string, unknown> = {};
  const keyOccurrences: KeyOccurrence[] = [];
  for (const pair of doc.contents.items) {
    const keyNode = pair.key;
    const key = isScalar(keyNode) ? String(keyNode.value) : String(keyNode);
    const offset = isScalar(keyNode) && keyNode.range ? keyNode.range[0] : 0;
    keyOccurrences.push({ key, line: offsetToLine(raw, offset) + 2 }); // +2: line 1 is ---
    data[key] = pair.value == null ? null : (pair.value as { toJSON(): unknown }).toJSON();
  }
  return { data, keyOccurrences };
}

function offsetToLine(text: string, offset: number): number {
  let line = 0;
  for (let i = 0; i < offset && i < text.length; i++) {
    if (text[i] === "\n") line++;
  }
  return line;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/skill-lint/parser/frontmatter.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/skill-lint/parser/
git commit -m "feat(engine): tolerant YAML frontmatter parser with colon recovery"
```

---

### Task 4: Markdown body parser

**Files:**
- Create: `lib/skill-lint/parser/markdown.ts`
- Test: `lib/skill-lint/parser/markdown.test.ts`

**Interfaces:**
- Consumes: `SkillBody` from `../model`
- Produces: `export function parseBody(raw: string, startLine: number): SkillBody;`

- [ ] **Step 1: Write the failing tests**

`lib/skill-lint/parser/markdown.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { parseBody } from "./markdown";

describe("parseBody", () => {
  it("extracts headings with depth and 1-based line numbers", () => {
    const b = parseBody("# Title\n\n## Section\ntext", 5);
    expect(b.headings).toEqual([
      { depth: 1, text: "Title", line: 5 },
      { depth: 2, text: "Section", line: 7 },
    ]);
  });

  it("excludes fenced code blocks from proseLines and headings", () => {
    const b = parseBody("prose\n```\n# not a heading\nyou should ignore this\n```\nafter", 1);
    expect(b.headings).toHaveLength(0);
    expect(b.proseLines.map((l) => l.text)).toEqual(["prose", "after"]);
  });

  it("extracts relative markdown links and backtick paths", () => {
    const b = parseBody("See [api](references/api.md) and `scripts/run.py` and [ext](https://x.com)", 1);
    expect(b.links).toEqual([
      { target: "references/api.md", line: 1, kind: "link" },
      { target: "https://x.com", line: 1, kind: "link" },
      { target: "scripts/run.py", line: 1, kind: "path" },
    ]);
  });

  it("counts words", () => {
    expect(parseBody("one two  three\nfour", 1).wordCount).toBe(4);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/skill-lint/parser/markdown.test.ts`
Expected: FAIL — "Cannot find module './markdown'".

- [ ] **Step 3: Implement markdown.ts**

```ts
import type { Heading, LinkRef, SkillBody } from "../model";

const FENCE_RE = /^\s*(```|~~~)/;
const HEADING_RE = /^(#{1,6})\s+(.+)$/;
const MD_LINK_RE = /\[[^\]]*\]\(([^)\s]+)(?:\s[^)]*)?\)/g;
const BACKTICK_PATH_RE = /`([^`\s]+\/[^`\s]+\.\w+)`/g;

export function parseBody(raw: string, startLine: number): SkillBody {
  const lines = raw.split("\n");
  const proseLines: { text: string; line: number }[] = [];
  const headings: Heading[] = [];
  const links: LinkRef[] = [];
  let inFence = false;

  lines.forEach((text, i) => {
    const line = startLine + i;
    if (FENCE_RE.test(text)) {
      inFence = !inFence;
      return;
    }
    if (inFence) return;
    proseLines.push({ text, line });

    const h = HEADING_RE.exec(text);
    if (h) headings.push({ depth: h[1].length, text: h[2].trim(), line });

    for (const m of text.matchAll(MD_LINK_RE)) {
      links.push({ target: m[1], line, kind: "link" });
    }
    for (const m of text.matchAll(BACKTICK_PATH_RE)) {
      links.push({ target: m[1], line, kind: "path" });
    }
  });

  return {
    raw,
    lines,
    proseLines,
    headings,
    links,
    wordCount: raw.split(/\s+/).filter(Boolean).length,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/skill-lint/parser/markdown.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/skill-lint/parser/markdown.ts lib/skill-lint/parser/markdown.test.ts
git commit -m "feat(engine): fence-aware markdown body parser"
```

---

### Task 5: Skill assembler (`parseSkill`)

**Files:**
- Create: `lib/skill-lint/parser/skill.ts`
- Test: `lib/skill-lint/parser/skill.test.ts`

**Interfaces:**
- Consumes: `extractFrontmatter` (Task 3), `parseBody` (Task 4), model types
- Produces:

```ts
export interface ParseOptions { dirName?: string }
export function parseSkill(files: SkillFile[], opts?: ParseOptions): ParseOutcome;
export function looksLikeSymlink(f: SkillFile): boolean;
```

- [ ] **Step 1: Write the failing tests**

`lib/skill-lint/parser/skill.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { parseSkill, looksLikeSymlink } from "./skill";

const VALID = `---\nname: demo-skill\ndescription: Use when demonstrating the parser\n---\n# Demo\nBody text.`;

describe("parseSkill", () => {
  it("parses a valid single-file skill", () => {
    const r = parseSkill([{ path: "SKILL.md", content: VALID }], { dirName: "demo-skill" });
    expect(r.kind).toBe("skill");
    if (r.kind === "skill") {
      expect(r.skill.frontmatter.data["name"]).toBe("demo-skill");
      expect(r.skill.dirName).toBe("demo-skill");
      expect(r.skill.filenameAsGiven).toBe("SKILL.md");
    }
  });

  it("accepts wrong-case skill.md but records the filename as given", () => {
    const r = parseSkill([{ path: "skill.md", content: VALID }]);
    expect(r.kind).toBe("skill");
    if (r.kind === "skill") expect(r.skill.filenameAsGiven).toBe("skill.md");
  });

  it("prefers exact SKILL.md over case variants", () => {
    const r = parseSkill([
      { path: "skill.md", content: VALID },
      { path: "SKILL.md", content: VALID },
    ]);
    if (r.kind === "skill") expect(r.skill.filenameAsGiven).toBe("SKILL.md");
  });

  it("returns not-a-skill when no SKILL.md exists", () => {
    const r = parseSkill([{ path: "README.md", content: "# hi" }]);
    expect(r).toEqual({ kind: "not-a-skill", reason: expect.stringMatching(/no skill\.md/i) });
  });

  it("returns not-a-skill for files without frontmatter (real-world fixture case)", () => {
    const r = parseSkill([{ path: "SKILL.md", content: "# Sample\n**Name**: fake\n" }]);
    expect(r.kind).toBe("not-a-skill");
    if (r.kind === "not-a-skill") expect(r.reason).toMatch(/frontmatter/i);
  });

  it("returns not-a-skill for a symlink degraded to a path string", () => {
    // Windows checkout of a git symlink: file content is just the target path
    const r = parseSkill([{ path: "SKILL.md", content: "../academic-paper" }]);
    expect(r.kind).toBe("not-a-skill");
    if (r.kind === "not-a-skill") expect(r.reason).toMatch(/symlink/i);
  });

  it("never throws on garbage input", () => {
    expect(() => parseSkill([{ path: "SKILL.md", content: "\0\0\0" }])).not.toThrow();
    expect(() => parseSkill([])).not.toThrow();
  });
});

describe("looksLikeSymlink", () => {
  it("detects explicit symlink flag and path-only content", () => {
    expect(looksLikeSymlink({ path: "SKILL.md", content: "x", symlink: true })).toBe(true);
    expect(looksLikeSymlink({ path: "SKILL.md", content: "../sibling/skills/foo" })).toBe(true);
    expect(looksLikeSymlink({ path: "SKILL.md", content: "---\nname: x\n---\nbody" })).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/skill-lint/parser/skill.test.ts`
Expected: FAIL — "Cannot find module './skill'".

- [ ] **Step 3: Implement skill.ts**

```ts
import type { ParseOutcome, SkillFile } from "../model";
import { extractFrontmatter } from "./frontmatter";
import { parseBody } from "./markdown";

export interface ParseOptions {
  dirName?: string;
}

export function looksLikeSymlink(f: SkillFile): boolean {
  if (f.symlink === true) return true;
  const c = f.content.trim();
  // A git symlink checked out without symlink support is a single-line relative path.
  return c.length > 0 && c.length < 260 && !c.includes("\n") && !c.includes(" ") && c.includes("/") && !c.startsWith("---");
}

export function parseSkill(files: SkillFile[], opts: ParseOptions = {}): ParseOutcome {
  const candidates = files.filter((f) => !f.path.includes("/") && f.path.toLowerCase() === "skill.md");
  const skillFile = candidates.find((f) => f.path === "SKILL.md") ?? candidates[0];

  if (!skillFile) {
    return { kind: "not-a-skill", reason: "No SKILL.md file found in the skill folder" };
  }
  if (looksLikeSymlink(skillFile)) {
    return {
      kind: "not-a-skill",
      reason: `SKILL.md is a symlink pointing to "${skillFile.content.trim()}" — resolve the link target instead`,
    };
  }

  const extracted = extractFrontmatter(skillFile.content);
  if (!extracted) {
    return {
      kind: "not-a-skill",
      reason: "No YAML frontmatter found (a skill must start with --- on line 1)",
    };
  }

  return {
    kind: "skill",
    skill: {
      dirName: opts.dirName,
      filenameAsGiven: skillFile.path,
      skillFile,
      frontmatter: extracted.frontmatter,
      body: parseBody(extracted.bodyRaw, extracted.bodyStartLine),
      files,
    },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/skill-lint/parser/skill.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/skill-lint/parser/skill.ts lib/skill-lint/parser/skill.test.ts
git commit -m "feat(engine): skill assembler with symlink and not-a-skill detection"
```

---

### Task 6: Rule engine

**Files:**
- Create: `lib/skill-lint/rules/util.ts`
- Create: `lib/skill-lint/rules/engine.ts`
- Test: `lib/skill-lint/rules/engine.test.ts`

**Interfaces:**
- Consumes: `Rule`, `Finding`, `ParsedSkill`, `RuleContext`, `Severity` from `../model`
- Produces:

```ts
// util.ts
export function mk(
  id: string, severity: Severity, message: string, why: string, howToFix: string,
  extra?: Partial<Finding>
): Finding;

// engine.ts
export function runRules(skill: ParsedSkill, rules: Rule[], ctx: RuleContext): Finding[];
```

- [ ] **Step 1: Write the failing tests**

`lib/skill-lint/rules/engine.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { runRules } from "./engine";
import { mk } from "./util";
import type { ParsedSkill, Rule } from "../model";

const skill = {} as ParsedSkill; // rules below don't inspect the skill

const always = (id: string, severity: Rule["severity"], profiles?: Rule["profiles"]): Rule => ({
  id,
  severity,
  profiles,
  check: () => [mk(id, severity, "msg", "why", "fix")],
});

describe("runRules", () => {
  it("collects findings sorted by severity then rule id", () => {
    const rules = [always("S01", "suggestion"), always("E02", "error"), always("W01", "warning"), always("E01", "error")];
    const out = runRules(skill, rules, { profile: "generic" });
    expect(out.map((f) => f.ruleId)).toEqual(["E01", "E02", "W01", "S01"]);
  });

  it("filters rules by profile", () => {
    const rules = [always("W14", "warning", ["claude-code-plugin"]), always("E01", "error")];
    expect(runRules(skill, rules, { profile: "generic" }).map((f) => f.ruleId)).toEqual(["E01"]);
    expect(runRules(skill, rules, { profile: "claude-code-plugin" }).map((f) => f.ruleId)).toEqual(["E01", "W14"]);
  });

  it("isolates a crashing rule as an internal finding instead of throwing", () => {
    const bad: Rule = { id: "X99", severity: "error", check: () => { throw new Error("boom"); } };
    const out = runRules(skill, [bad], { profile: "generic" });
    expect(out).toHaveLength(1);
    expect(out[0].ruleId).toBe("X99");
    expect(out[0].message).toMatch(/internal error/i);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/skill-lint/rules/engine.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement util.ts and engine.ts**

`lib/skill-lint/rules/util.ts`:
```ts
import type { Finding, Severity } from "../model";

export function mk(
  id: string,
  severity: Severity,
  message: string,
  why: string,
  howToFix: string,
  extra: Partial<Finding> = {}
): Finding {
  return { ruleId: id, severity, message, why, howToFix, ...extra };
}
```

`lib/skill-lint/rules/engine.ts`:
```ts
import type { Finding, ParsedSkill, Rule, RuleContext } from "../model";
import { mk } from "./util";

const SEVERITY_ORDER = { error: 0, warning: 1, suggestion: 2 } as const;

export function runRules(skill: ParsedSkill, rules: Rule[], ctx: RuleContext): Finding[] {
  const findings: Finding[] = [];
  for (const rule of rules) {
    if (rule.profiles && !rule.profiles.includes(ctx.profile)) continue;
    try {
      findings.push(...rule.check(skill, ctx));
    } catch (e) {
      findings.push(
        mk(
          rule.id,
          rule.severity,
          `Rule ${rule.id} hit an internal error and was skipped`,
          "A linter bug should never block your analysis — the remaining rules still ran.",
          `Report this: ${e instanceof Error ? e.message : String(e)}`
        )
      );
    }
  }
  return findings.sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || a.ruleId.localeCompare(b.ruleId)
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/skill-lint/rules/engine.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/skill-lint/rules/
git commit -m "feat(engine): rule engine with profile filtering and crash isolation"
```

---

### Task 7: Frontmatter error rules E01–E07

**Files:**
- Create: `lib/skill-lint/rules/errors-frontmatter.ts`
- Test: `lib/skill-lint/rules/errors-frontmatter.test.ts`

**Interfaces:**
- Consumes: `mk` (Task 6), model types, `parseSkill` (Task 5, used in tests as builder)
- Produces: `export const frontmatterErrorRules: Rule[];` containing rules with ids `E01`–`E07`

Rule reference (from spec §5):
- E01 valid YAML mapping frontmatter — fires on `parseError` (and NOT when `recovered`, that is E12's job)
- E02 `name` present, matches `^[a-z0-9]+(-[a-z0-9]+)*$`, ≤ 64 chars
- E03 `name` must not contain "claude" or "anthropic" (reserved)
- E04 `name` equals folder name (only when `dirName` is known)
- E05 `description` present, a single occurrence, non-empty string, ≤ 1024 chars
- E06 no `<` or `>` in any frontmatter value (recursive — values are injected into the system prompt)
- E07 `compatibility` ≤ 500 chars when present

- [ ] **Step 1: Write the failing tests**

`lib/skill-lint/rules/errors-frontmatter.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { frontmatterErrorRules } from "./errors-frontmatter";
import { runRules } from "./engine";
import { parseSkill } from "../parser/skill";
import type { ParsedSkill } from "../model";

function build(fm: string, dirName?: string): ParsedSkill {
  const r = parseSkill([{ path: "SKILL.md", content: `---\n${fm}\n---\nBody` }], { dirName });
  if (r.kind !== "skill") throw new Error("fixture is not a skill: " + r.reason);
  return r.skill;
}

function idsFor(fm: string, dirName?: string): string[] {
  return runRules(build(fm, dirName), frontmatterErrorRules, { profile: "generic" }).map((f) => f.ruleId);
}

describe("E01 valid YAML", () => {
  it("fires on unparseable frontmatter", () => {
    const skill = build("name: x\ndescription: ok");
    skill.frontmatter.parseError = { message: "bad" };
    const ids = runRules(skill, frontmatterErrorRules, { profile: "generic" }).map((f) => f.ruleId);
    expect(ids).toContain("E01");
  });
  it("does not fire on recovered frontmatter (E12 owns that)", () => {
    const skill = build("name: x\ndescription: ok");
    skill.frontmatter.recovered = true;
    const ids = runRules(skill, frontmatterErrorRules, { profile: "generic" }).map((f) => f.ruleId);
    expect(ids).not.toContain("E01");
  });
});

describe("E02 name format", () => {
  it("passes a valid kebab-case name", () => {
    expect(idsFor("name: my-good-skill\ndescription: Use when testing")).not.toContain("E02");
  });
  it.each([
    ["missing", "description: only"],
    ["uppercase", "name: MySkill\ndescription: x"],
    ["leading hyphen", "name: -21risk\ndescription: x"],
    ["double hyphen", "name: a--b\ndescription: x"],
    ["underscore", "name: a_b\ndescription: x"],
    ["too long", `name: ${"a".repeat(65)}\ndescription: x`],
  ])("fires on %s", (_label, fm) => {
    expect(idsFor(fm)).toContain("E02");
  });
});

describe("E03 reserved words", () => {
  it("fires on claude/anthropic in name", () => {
    expect(idsFor("name: claude-helper\ndescription: x")).toContain("E03");
    expect(idsFor("name: anthropic-tools\ndescription: x")).toContain("E03");
    expect(idsFor("name: my-skill\ndescription: x")).not.toContain("E03");
  });
});

describe("E04 name matches folder", () => {
  it("fires on mismatch, silent when dirName unknown", () => {
    expect(idsFor("name: my-skill\ndescription: x", "other-folder")).toContain("E04");
    expect(idsFor("name: my-skill\ndescription: x", "my-skill")).not.toContain("E04");
    expect(idsFor("name: my-skill\ndescription: x")).not.toContain("E04");
  });
});

describe("E05 description", () => {
  it("fires on missing, empty, non-string, too long, duplicated", () => {
    expect(idsFor("name: a-b")).toContain("E05");
    expect(idsFor('name: a-b\ndescription: ""')).toContain("E05");
    expect(idsFor("name: a-b\ndescription: 42")).toContain("E05");
    expect(idsFor(`name: a-b\ndescription: ${"x".repeat(1025)}`)).toContain("E05");
    expect(idsFor("name: a-b\ndescription: one\ndescription: two")).toContain("E05");
    expect(idsFor("name: a-b\ndescription: Use when testing")).not.toContain("E05");
  });
});

describe("E06 no angle brackets in frontmatter values", () => {
  it("fires on <> anywhere, including nested metadata", () => {
    expect(idsFor("name: a-b\ndescription: use <tag> here")).toContain("E06");
    expect(idsFor("name: a-b\ndescription: ok\nmetadata:\n  author: <me>")).toContain("E06");
    expect(idsFor("name: a-b\ndescription: ok")).not.toContain("E06");
  });
});

describe("E07 compatibility length", () => {
  it("fires only above 500 chars", () => {
    expect(idsFor(`name: a-b\ndescription: ok\ncompatibility: ${"c".repeat(501)}`)).toContain("E07");
    expect(idsFor("name: a-b\ndescription: ok\ncompatibility: Requires Claude Code")).not.toContain("E07");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/skill-lint/rules/errors-frontmatter.test.ts`
Expected: FAIL — "Cannot find module './errors-frontmatter'".

- [ ] **Step 3: Implement errors-frontmatter.ts**

```ts
import type { Finding, ParsedSkill, Rule } from "../model";
import { mk } from "./util";

const NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const OFFICIAL_DOCS = "https://agentskills.io/specification";

function str(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

const e01: Rule = {
  id: "E01",
  severity: "error",
  check(s) {
    if (!s.frontmatter.parseError || s.frontmatter.recovered) return [];
    return [
      mk("E01", "error",
        `Frontmatter is not valid YAML: ${s.frontmatter.parseError.message}`,
        "Claude cannot load a skill whose frontmatter does not parse — the skill is silently ignored.",
        "Fix the YAML syntax between the --- delimiters. Common causes: bad indentation, unclosed quotes.",
        { line: s.frontmatter.parseError.line }),
    ];
  },
};

const e02: Rule = {
  id: "E02",
  severity: "error",
  check(s) {
    const name = str(s.frontmatter.data["name"]);
    const out: Finding[] = [];
    if (!name) {
      out.push(mk("E02", "error", "Missing required field: name",
        "name and description are the only required fields — without name the skill cannot be registered.",
        `Add name: your-skill-name (kebab-case). Spec: ${OFFICIAL_DOCS}`));
      return out;
    }
    if (name.length > 64) {
      out.push(mk("E02", "error", `name is ${name.length} chars (max 64)`,
        "The official validator rejects names over 64 characters.",
        "Shorten the name to 64 characters or fewer."));
    }
    if (!NAME_RE.test(name)) {
      out.push(mk("E02", "error", `name "${name}" is not kebab-case`,
        "Names must match ^[a-z0-9]+(-[a-z0-9]+)*$ — lowercase letters, digits and single hyphens, no leading/trailing hyphen.",
        "Rename using only lowercase letters, numbers and hyphens, e.g. processing-pdfs."));
    }
    return out;
  },
};

const e03: Rule = {
  id: "E03",
  severity: "error",
  check(s) {
    const name = str(s.frontmatter.data["name"]) ?? "";
    if (!/(claude|anthropic)/i.test(name)) return [];
    return [
      mk("E03", "error", `name "${name}" contains a reserved word (claude/anthropic)`,
        "Anthropic reserves these words in skill names; uploads with them are rejected.",
        "Pick a name that describes the capability instead, e.g. reviewing-code."),
    ];
  },
};

const e04: Rule = {
  id: "E04",
  severity: "error",
  check(s) {
    const name = str(s.frontmatter.data["name"]);
    if (!name || !s.dirName || s.dirName === name) return [];
    return [
      mk("E04", "error", `name "${name}" does not match folder "${s.dirName}"`,
        "Tools resolve skills by folder name; a mismatch breaks installs and imports.",
        `Rename the folder to "${name}" or change name: to "${s.dirName}".`),
    ];
  },
};

const e05: Rule = {
  id: "E05",
  severity: "error",
  check(s) {
    const out: Finding[] = [];
    const raw = s.frontmatter.data["description"];
    const occurrences = s.frontmatter.keyOccurrences.filter((k) => k.key.toLowerCase() === "description");
    if (occurrences.length > 1) {
      out.push(mk("E05", "error", "description appears more than once",
        "Duplicate keys are invalid YAML per spec; parsers silently keep only one value.",
        "Keep a single description field.", { line: occurrences[1].line }));
    }
    if (raw === undefined) {
      out.push(mk("E05", "error", "Missing required field: description",
        "The description is the ONLY thing Claude sees when deciding to load your skill.",
        'Add description: "Use when …" describing what it does and when to use it.'));
      return out;
    }
    const desc = str(raw);
    if (desc === undefined) {
      out.push(mk("E05", "error", "description must be a string",
        "Non-string values fail the official validator.",
        "Quote the value so YAML treats it as a string."));
      return out;
    }
    if (desc.trim().length === 0) {
      out.push(mk("E05", "error", "description is empty",
        "An empty description means the skill will never be discovered or triggered.",
        "Describe what the skill does and when to use it."));
    }
    if (desc.length > 1024) {
      out.push(mk("E05", "error", `description is ${desc.length} chars (max 1024)`,
        "The official validator rejects descriptions over 1024 characters.",
        "Trim it — move detail into the skill body, keep triggers in the description."));
    }
    return out;
  },
};

const e06: Rule = {
  id: "E06",
  severity: "error",
  check(s) {
    const offenders: string[] = [];
    walk(s.frontmatter.data, "", offenders);
    return offenders.map((path) =>
      mk("E06", "error", `Frontmatter value at "${path}" contains < or >`,
        "Frontmatter is injected into the system prompt; angle brackets can be parsed as tags (prompt-injection surface). The official validator rejects them.",
        "Remove or rephrase without < and > characters.")
    );
  },
};

function walk(v: unknown, path: string, out: string[]): void {
  if (typeof v === "string") {
    if (v.includes("<") || v.includes(">")) out.push(path || "(root)");
  } else if (Array.isArray(v)) {
    v.forEach((item, i) => walk(item, `${path}[${i}]`, out));
  } else if (v && typeof v === "object") {
    for (const [k, val] of Object.entries(v)) walk(val, path ? `${path}.${k}` : k, out);
  }
}

const e07: Rule = {
  id: "E07",
  severity: "error",
  check(s) {
    const c = str(s.frontmatter.data["compatibility"]);
    if (c === undefined || c.length <= 500) return [];
    return [
      mk("E07", "error", `compatibility is ${c.length} chars (max 500)`,
        "The official validator caps compatibility at 500 characters.",
        "Shorten it to the environment requirements only."),
    ];
  },
};

export const frontmatterErrorRules: Rule[] = [e01, e02, e03, e04, e05, e06, e07];
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/skill-lint/rules/errors-frontmatter.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add lib/skill-lint/rules/errors-frontmatter.ts lib/skill-lint/rules/errors-frontmatter.test.ts
git commit -m "feat(engine): frontmatter error rules E01-E07"
```

---

### Task 8: Structural error rules E08–E12

**Files:**
- Create: `lib/skill-lint/rules/errors-structure.ts`
- Test: `lib/skill-lint/rules/errors-structure.test.ts`

**Interfaces:**
- Consumes: `mk`, model types, `parseSkill` (in tests)
- Produces: `export const structureErrorRules: Rule[];` with ids `E08`–`E12`

Rule reference (from spec §5):
- E08 filename must be exactly `SKILL.md` (uses `filenameAsGiven`)
- E09 relative links/paths in the body must resolve to files in `files`
- E10 no tab characters in frontmatter indentation
- E11 no `README.md` inside the skill folder (top level)
- E12 recovered YAML (unquoted colon) → error WITH autofix that rewrites SKILL.md using `frontmatter.fixedRaw`

- [ ] **Step 1: Write the failing tests**

`lib/skill-lint/rules/errors-structure.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { structureErrorRules } from "./errors-structure";
import { runRules } from "./engine";
import { parseSkill } from "../parser/skill";
import type { SkillFile } from "../model";

const VALID = `---\nname: demo\ndescription: Use when testing\n---\nSee [api](references/api.md)`;

function findingsFor(files: SkillFile[]) {
  const r = parseSkill(files);
  if (r.kind !== "skill") throw new Error("fixture is not a skill: " + r.reason);
  return runRules(r.skill, structureErrorRules, { profile: "generic" });
}

describe("E08 exact filename", () => {
  it("fires on skill.md, silent on SKILL.md", () => {
    const bad = findingsFor([{ path: "skill.md", content: VALID.replace("references/api.md", "skill.md") }]);
    expect(bad.map((f) => f.ruleId)).toContain("E08");
  });
});

describe("E09 broken relative links", () => {
  it("fires when a linked file does not exist", () => {
    const out = findingsFor([{ path: "SKILL.md", content: VALID }]);
    const e09 = out.filter((f) => f.ruleId === "E09");
    expect(e09).toHaveLength(1);
    expect(e09[0].message).toContain("references/api.md");
  });
  it("silent when the file exists; ignores http and anchors", () => {
    const content = `---\nname: demo\ndescription: x\n---\n[a](references/api.md) [b](https://x.com) [c](#section)`;
    const out = findingsFor([
      { path: "SKILL.md", content },
      { path: "references/api.md", content: "ref" },
    ]);
    expect(out.map((f) => f.ruleId)).not.toContain("E09");
  });
});

describe("E10 tabs in frontmatter", () => {
  it("fires on tab-indented YAML", () => {
    const out = findingsFor([{ path: "SKILL.md", content: `---\nname: demo\ndescription: ok\nmetadata:\n\tauthor: me\n---\nbody` }]);
    expect(out.map((f) => f.ruleId)).toContain("E10");
  });
});

describe("E11 no README inside skill folder", () => {
  it("fires on README.md at skill root only", () => {
    const skillmd = { path: "SKILL.md", content: `---\nname: demo\ndescription: x\n---\nbody` };
    expect(findingsFor([skillmd, { path: "README.md", content: "no" }]).map((f) => f.ruleId)).toContain("E11");
    expect(findingsFor([skillmd, { path: "references/README.md", content: "ok" }]).map((f) => f.ruleId)).not.toContain("E11");
  });
});

describe("E12 recovered YAML with autofix", () => {
  it("fires with a working fix", () => {
    const broken = `---\nname: demo\ndescription: Unlike normal review: it attacks\n---\nbody`;
    const files: SkillFile[] = [{ path: "SKILL.md", content: broken }];
    const out = findingsFor(files);
    const e12 = out.find((f) => f.ruleId === "E12");
    expect(e12).toBeDefined();
    expect(e12!.fix).toBeDefined();
    const fixed = e12!.fix!.apply(files);
    const refixed = parseSkill(fixed);
    expect(refixed.kind).toBe("skill");
    if (refixed.kind === "skill") {
      expect(refixed.skill.frontmatter.recovered).toBeUndefined();
      expect(refixed.skill.frontmatter.data["description"]).toBe("Unlike normal review: it attacks");
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/skill-lint/rules/errors-structure.test.ts`
Expected: FAIL — "Cannot find module './errors-structure'".

- [ ] **Step 3: Implement errors-structure.ts**

```ts
import type { Finding, Rule, SkillFile } from "../model";
import { mk } from "./util";

const e08: Rule = {
  id: "E08",
  severity: "error",
  check(s) {
    if (s.filenameAsGiven === "SKILL.md") return [];
    return [
      mk("E08", "error", `File is named "${s.filenameAsGiven}" — must be exactly "SKILL.md"`,
        "Skill discovery is case-sensitive: skill.md or Skill.md is silently ignored by Claude.",
        "Rename the file to SKILL.md (uppercase SKILL, lowercase md)."),
    ];
  },
};

function normalize(target: string): string {
  return target.replace(/^\.\//, "").split("#")[0];
}

function isRelative(target: string): boolean {
  return !/^(https?:|mailto:|#|\/)/.test(target);
}

const e09: Rule = {
  id: "E09",
  severity: "error",
  check(s) {
    const paths = new Set(s.files.map((f) => f.path));
    const out: Finding[] = [];
    for (const link of s.body.links) {
      if (!isRelative(link.target)) continue;
      const t = normalize(link.target);
      if (t && !paths.has(t)) {
        out.push(
          mk("E09", "error", `Link target "${link.target}" does not exist in the skill folder`,
            "Claude follows these paths to load references — a broken link means missing context at runtime.",
            `Create ${t} or fix the path.`, { line: link.line })
        );
      }
    }
    return out;
  },
};

const e10: Rule = {
  id: "E10",
  severity: "error",
  check(s) {
    const lines = s.frontmatter.raw.split("\n");
    const out: Finding[] = [];
    lines.forEach((l, i) => {
      if (/^\t| \t/.test(l)) {
        out.push(
          mk("E10", "error", "Tab character in frontmatter indentation",
            "YAML forbids tabs for indentation — the frontmatter will fail to parse in strict loaders.",
            "Replace tabs with spaces.", { line: i + 2 })
        );
      }
    });
    return out;
  },
};

const e11: Rule = {
  id: "E11",
  severity: "error",
  check(s) {
    if (!s.files.some((f) => f.path === "README.md")) return [];
    return [
      mk("E11", "error", "README.md found inside the skill folder",
        "The official validator rejects skills containing a README.md — human docs belong in the repo, outside the skill folder.",
        "Move README.md out of the skill folder (e.g. to the repo root).",
        { file: "README.md" }),
    ];
  },
};

const e12: Rule = {
  id: "E12",
  severity: "error",
  check(s) {
    if (!s.frontmatter.recovered || !s.frontmatter.fixedRaw) return [];
    const fixedRaw = s.frontmatter.fixedRaw;
    const skillPath = s.skillFile.path;
    return [
      mk("E12", "error", "Unquoted ': ' inside a frontmatter value breaks YAML parsing",
        "Strict YAML loaders fail with 'mapping values are not allowed here' — ~1% of published skills have this exact bug and are silently unloadable.",
        "Wrap the value in double quotes.",
        {
          fix: {
            label: "Quote the offending value",
            apply(files: SkillFile[]): SkillFile[] {
              return files.map((f) => {
                if (f.path !== skillPath) return f;
                const lines = f.content.replace(/^﻿/, "").split("\n");
                const closing = lines.findIndex((l, i) => i > 0 && l.trim() === "---");
                const rebuilt = ["---", fixedRaw, ...lines.slice(closing)].join("\n");
                return { ...f, content: rebuilt };
              });
            },
          },
        }),
    ];
  },
};

export const structureErrorRules: Rule[] = [e08, e09, e10, e11, e12];
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/skill-lint/rules/errors-structure.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add lib/skill-lint/rules/errors-structure.ts lib/skill-lint/rules/errors-structure.test.ts
git commit -m "feat(engine): structural error rules E08-E12 with YAML autofix"
```

---

### Task 9: Score

**Files:**
- Create: `lib/skill-lint/score.ts`
- Test: `lib/skill-lint/score.test.ts`

**Interfaces:**
- Consumes: `Finding`, `ScoreResult` from `./model`
- Produces:

```ts
export const SCORE_WEIGHTS: { error: number; warning: number; suggestion: number };
export function computeScore(findings: Finding[]): ScoreResult;
```

> **Calibration note:** the weights below are the spec's starting values (error 15 / warning 5 / suggestion 1). Spec §6 marks final calibration as an open decision to settle against the fixture corpus — keep the weights in the exported `SCORE_WEIGHTS` constant so calibrating means editing one object.

- [ ] **Step 1: Write the failing tests**

`lib/skill-lint/score.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { computeScore } from "./score";
import { mk } from "./rules/util";

describe("computeScore", () => {
  it("returns 100 / excellent with no findings", () => {
    expect(computeScore([])).toEqual({ value: 100, band: "excellent" });
  });

  it("weights severities: error 15, warning 5, suggestion 1", () => {
    const findings = [
      mk("E01", "error", "m", "w", "f"),
      mk("W01", "warning", "m", "w", "f"),
      mk("S01", "suggestion", "m", "w", "f"),
    ];
    expect(computeScore(findings).value).toBe(100 - 15 - 5 - 1);
  });

  it("never goes below 0 and assigns bands", () => {
    const errors = Array.from({ length: 10 }, (_, i) => mk(`E${i}`, "error" as const, "m", "w", "f"));
    const r = computeScore(errors);
    expect(r.value).toBe(0);
    expect(r.band).toBe("poor");
    expect(computeScore([mk("W01", "warning", "m", "w", "f")]).band).toBe("excellent"); // 95
    expect(computeScore([mk("E01", "error", "m", "w", "f"), mk("E02", "error", "m", "w", "f")]).band).toBe("good"); // 70
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/skill-lint/score.test.ts`
Expected: FAIL — "Cannot find module './score'".

- [ ] **Step 3: Implement score.ts**

```ts
import type { Finding, ScoreResult } from "./model";

/** Starting weights per spec §6 — calibrate against the fixture corpus by editing this object only. */
export const SCORE_WEIGHTS = { error: 15, warning: 5, suggestion: 1 };

export function computeScore(findings: Finding[]): ScoreResult {
  const penalty = findings.reduce((sum, f) => sum + SCORE_WEIGHTS[f.severity], 0);
  const value = Math.max(0, 100 - penalty);
  const band = value >= 90 ? "excellent" : value >= 70 ? "good" : value >= 40 ? "needs-work" : "poor";
  return { value, band };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/skill-lint/score.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/skill-lint/score.ts lib/skill-lint/score.test.ts
git commit -m "feat(engine): score with calibratable weights"
```

---

### Task 10: Public API + fixture corpus integration test

**Files:**
- Create: `lib/skill-lint/index.ts`
- Create: `lib/skill-lint/fixtures/valid-full/SKILL.md`, `lib/skill-lint/fixtures/valid-full/references/api.md`, `lib/skill-lint/fixtures/valid-full/scripts/run.py`
- Create: `lib/skill-lint/fixtures/fixtures.ts` (in-code fixtures for broken cases)
- Test: `lib/skill-lint/index.test.ts`
- Delete: `lib/skill-lint/smoke.test.ts` (superseded by real tests)

**Interfaces:**
- Consumes: everything from Tasks 2–9
- Produces (the ONLY entry point Plans 2–5 import):

```ts
export type LintOutcome =
  | { kind: "skill"; skill: ParsedSkill; findings: Finding[]; score: ScoreResult; tokens: TokenReport }
  | { kind: "not-a-skill"; reason: string };

export interface LintOptions { profile?: Profile; dirName?: string }
export function lintSkill(files: SkillFile[], opts?: LintOptions): LintOutcome;
export const allRules: Rule[]; // E01–E12 for now; Plan 2 appends W/S rules here
// Re-exports: all model types, estimateTokens, tokenReport, computeScore, parseSkill
```

- [ ] **Step 1: Create the valid-full fixture on disk**

`lib/skill-lint/fixtures/valid-full/SKILL.md`:
```markdown
---
name: valid-full
description: Use when verifying the Skillsmith lint engine end to end with a well-formed multi-file skill
license: MIT
---

# Valid Full

## Overview

Reference fixture demonstrating a compliant skill.

## Usage

Read [the API reference](references/api.md) before running `scripts/run.py`.

## Additional Resources

- [API reference](references/api.md)
```

`lib/skill-lint/fixtures/valid-full/references/api.md`:
```markdown
# API Reference

Details live here so the SKILL.md body stays small.
```

`lib/skill-lint/fixtures/valid-full/scripts/run.py`:
```python
print("hello from the fixture")
```

- [ ] **Step 2: Create in-code broken fixtures**

`lib/skill-lint/fixtures/fixtures.ts`:
```ts
import type { SkillFile } from "../model";

/** Verified real-world failure: unquoted ': ' in description (boraoztunc/adversarial-review). */
export const BROKEN_YAML_COLON: SkillFile[] = [
  {
    path: "SKILL.md",
    content: `---\nname: adversarial-review\ndescription: Unlike normal code review: it leads with attacks\n---\n# Body\n`,
  },
];

/** Verified real-world case: duplicate mixed-case keys (alirezarezvani/claude-coach). */
export const DUP_MIXED_KEYS: SkillFile[] = [
  {
    path: "SKILL.md",
    content: `---\nName: claude-coach\nname: claude-coach\ndescription: Use when coaching\n---\nbody\n`,
  },
];

/** Verified real-world case: pseudo-frontmatter fixture (alirezarezvani sample-skill). */
export const NO_FRONTMATTER: SkillFile[] = [
  { path: "SKILL.md", content: `# Sample Skill\n\n**Name**: sample\n**Tier**: 1\n` },
];

/** Verified real-world case: git symlink degraded on Windows (imbad0202/academic-research-skills). */
export const SYMLINK_DEGRADED: SkillFile[] = [{ path: "SKILL.md", content: "../academic-paper" }];

/** Everything wrong at once: bad name, reserved word via name, missing description quote issues. */
export const KITCHEN_SINK_BAD: SkillFile[] = [
  {
    path: "skill.md",
    content: `---\nname: My_Claude-Skill\ncompatibility: ${"x".repeat(501)}\n---\nSee [gone](references/missing.md)\n`,
  },
  { path: "README.md", content: "should not be here" },
];
```

- [ ] **Step 3: Write the failing integration tests**

`lib/skill-lint/index.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { lintSkill } from "./index";
import {
  BROKEN_YAML_COLON,
  DUP_MIXED_KEYS,
  NO_FRONTMATTER,
  SYMLINK_DEGRADED,
  KITCHEN_SINK_BAD,
} from "./fixtures/fixtures";

const FIX = join(__dirname, "fixtures");

function loadValidFull() {
  return [
    { path: "SKILL.md", content: readFileSync(join(FIX, "valid-full/SKILL.md"), "utf8") },
    { path: "references/api.md", content: readFileSync(join(FIX, "valid-full/references/api.md"), "utf8") },
    { path: "scripts/run.py", content: readFileSync(join(FIX, "valid-full/scripts/run.py"), "utf8") },
  ];
}

describe("lintSkill end to end", () => {
  it("valid-full fixture: zero errors, score >= 90, token breakdown present", () => {
    const r = lintSkill(loadValidFull(), { dirName: "valid-full" });
    expect(r.kind).toBe("skill");
    if (r.kind === "skill") {
      expect(r.findings.filter((f) => f.severity === "error")).toEqual([]);
      expect(r.score.value).toBeGreaterThanOrEqual(90);
      expect(r.tokens.metadata).toBeGreaterThan(0);
      expect(r.tokens.references).toBeGreaterThan(0);
      expect(r.tokens.scriptFiles).toBe(1);
    }
  });

  it("broken-yaml-colon: E12 with an autofix that clears the error", () => {
    const r = lintSkill(BROKEN_YAML_COLON);
    if (r.kind !== "skill") throw new Error(r.reason);
    const e12 = r.findings.find((f) => f.ruleId === "E12");
    expect(e12?.fix).toBeDefined();
    const again = lintSkill(e12!.fix!.apply(BROKEN_YAML_COLON));
    if (again.kind !== "skill") throw new Error("fix broke the skill");
    expect(again.findings.map((f) => f.ruleId)).not.toContain("E12");
  });

  it("dup-mixed-keys: parses with last-wins", () => {
    const r = lintSkill(DUP_MIXED_KEYS);
    expect(r.kind).toBe("skill");
    if (r.kind === "skill") expect(r.skill.frontmatter.data["name"]).toBe("claude-coach");
  });

  it("no-frontmatter and symlink fixtures: not-a-skill, never a crash", () => {
    expect(lintSkill(NO_FRONTMATTER).kind).toBe("not-a-skill");
    expect(lintSkill(SYMLINK_DEGRADED).kind).toBe("not-a-skill");
  });

  it("kitchen-sink: fires E02, E05, E07, E08, E09, E11 and scores poor", () => {
    const r = lintSkill(KITCHEN_SINK_BAD);
    if (r.kind !== "skill") throw new Error(r.reason);
    const ids = new Set(r.findings.map((f) => f.ruleId));
    for (const expected of ["E02", "E05", "E07", "E08", "E09", "E11"]) {
      expect(ids).toContain(expected);
    }
    expect(r.score.value).toBeLessThan(40);
    expect(r.score.band).toBe("poor");
  });
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `npx vitest run lib/skill-lint/index.test.ts`
Expected: FAIL — "Cannot find module './index'".

- [ ] **Step 5: Implement index.ts and delete the smoke test**

`lib/skill-lint/index.ts`:
```ts
import type { Finding, ParsedSkill, Profile, Rule, ScoreResult, SkillFile, TokenReport } from "./model";
import { parseSkill } from "./parser/skill";
import { runRules } from "./rules/engine";
import { frontmatterErrorRules } from "./rules/errors-frontmatter";
import { structureErrorRules } from "./rules/errors-structure";
import { computeScore } from "./score";
import { tokenReport } from "./tokens";

export type LintOutcome =
  | { kind: "skill"; skill: ParsedSkill; findings: Finding[]; score: ScoreResult; tokens: TokenReport }
  | { kind: "not-a-skill"; reason: string };

export interface LintOptions {
  profile?: Profile;
  dirName?: string;
}

/** Full rule catalog. Plan 2 appends the W and S rule packs here. */
export const allRules: Rule[] = [...frontmatterErrorRules, ...structureErrorRules];

export function lintSkill(files: SkillFile[], opts: LintOptions = {}): LintOutcome {
  const outcome = parseSkill(files, { dirName: opts.dirName });
  if (outcome.kind === "not-a-skill") return outcome;
  const findings = runRules(outcome.skill, allRules, { profile: opts.profile ?? "generic" });
  return {
    kind: "skill",
    skill: outcome.skill,
    findings,
    score: computeScore(findings),
    tokens: tokenReport(outcome.skill),
  };
}

export * from "./model";
export { estimateTokens, tokenReport } from "./tokens";
export { computeScore, SCORE_WEIGHTS } from "./score";
export { parseSkill } from "./parser/skill";
```

Delete the placeholder: `rm lib/skill-lint/smoke.test.ts` (git tracks the deletion).

- [ ] **Step 6: Run the full suite**

Run: `npm test`
Expected: PASS — all test files green (tokens, frontmatter, markdown, skill, engine, errors-frontmatter, errors-structure, score, index).

- [ ] **Step 7: Verify the static build still passes (engine must not break the app)**

Run: `npm run build`
Expected: build succeeds, `out/index.html` exists.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(engine): public lintSkill API with real-world fixture corpus"
```

---

## Self-Review (run after writing, before handoff)

1. **Spec coverage (Plan 1 scope):** spec §3 architecture (Tasks 1, 10), §4 parser items 1–4, 8–9 (Tasks 3–5; items 5–7 field classification arrive with W-rules in Plan 2), §5 errors E01–E12 (Tasks 7–8), §6 score (Task 9), §7 tokens (Task 2), §10 testing/fixtures (Task 10), §11 never-crash (Tasks 3, 5, 6). Sections §5 W/S rules, §8 wizard, §9 importer are Plans 2–5 by design.
2. **Placeholder scan:** none — every step carries complete code or exact commands.
3. **Type consistency:** `Finding.fix?: AutoFix` (Task 2) matches E12 usage (Task 8); `frontmatter.fixedRaw` produced in Task 3, consumed in Task 8; `filenameAsGiven` produced in Task 5, consumed in Task 8; `allRules` produced in Task 10 as the extension point Plan 2 appends to.
