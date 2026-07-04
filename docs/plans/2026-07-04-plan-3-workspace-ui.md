# Skillsmith Plan 3: Workspace UI + Analyze Entries + Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The client-side workspace that consumes the Plan 1/2 engine: a three-column editor (file tree + textarea + Findings/Tokens tabs) with live lint, autofix, score badge, profile switch, and package export (.zip / .skill / copy). Plus the three analyze entry points (paste / upload / .zip / drop), a real SEO landing page, and a shared nav header — all as a 100% static export.

**Architecture:** Everything interactive is a client component (`"use client"`). The engine (`lib/skill-lint`) stays pure; the UI calls `lintSkill(files, { profile, dirName })` inside a `useMemo` and renders the `LintOutcome`. Two new pure, node-testable libraries sit beside the engine: `lib/zip.ts` (fflate zip/unzip + browser download) and `lib/handoff.ts` (sessionStorage hand-off from the future wizard/importer). Workspace state lives in a `useReducer` hook (`components/workspace/useWorkspace.ts`) whose reducer is exported and unit-tested in isolation. No server actions, no API routes, no route handlers, no dynamic routes — `output: 'export'` must keep working. Spec: `docs/specs/2026-07-04-skillsmith-design.md` (§3 flow, §7 tokens, §11 errors).

**Tech Stack:** Next.js 15 (static export) + React 19 + Tailwind 4, TypeScript strict, Vitest 3. New runtime dep: `fflate`. New dev deps: `jsdom`, `@testing-library/react`, `@testing-library/user-event`, `@vitejs/plugin-react`. Node 22. npm.

**Roadmap context:** This is Plan 3 of 5. Plan 1 (engine core E01–E12) and Plan 2 (W/S rule packs) precede it; the engine is consumed here read-only. Plan 4 (wizard `/new`) and Plan 5 (GitHub importer `/import`) both produce a skill in memory, call `stashIncomingSkill(...)`, then navigate to `/workspace` — this plan builds the receiving end.

## Global Constraints

- 100% static: `output: 'export'` in `next.config.ts` — no server components with data fetching, no server actions, no API routes, no route handlers, no `headers()`/`cookies()`, no dynamic route segments. `next build` must emit `out/workspace*`.
- Anything under `lib/skill-lint/` is untouched. Do not modify the engine — consume it via `import { lintSkill, ... } from "@/lib/skill-lint"`.
- Engine API is fixed (verified against `lib/skill-lint/index.ts`): `lintSkill(files: SkillFile[], opts?: { profile?: Profile; dirName?: string }): LintOutcome`, where `LintOutcome = { kind: "skill"; skill; findings: Finding[]; score: ScoreResult; tokens: TokenReport } | { kind: "not-a-skill"; reason: string }`. A `Finding` has `ruleId/severity/message/why/howToFix/file?/line?/fix?` and `fix` is an `AutoFix` `{ label: string; apply(files: SkillFile[]): SkillFile[] }`. Never invent other engine functions or fields.
- Browser-only APIs (`document`, `navigator`, `window`, `localStorage`, `sessionStorage`, `URL.createObjectURL`) may only be touched inside `"use client"` components, event handlers, or `useEffect` — never at module top level or during render/SSR. Guard lazy reads with `typeof window !== "undefined"`.
- Draft persistence and hand-off restore run in `useEffect` (after mount), never in the reducer's lazy initializer — this keeps SSR/hydration deterministic (server renders the demo skill; client restores after).
- `localStorage`/`sessionStorage` writes are wrapped in try/catch; quota/serialization errors are non-fatal (`console.warn` only, per spec §11). Files over 2 MB are rejected with a message (spec §11).
- Export gate: the "Download .zip" and "Download .skill" buttons are disabled whenever any `error`-severity finding exists (title tooltip explains). "Copy SKILL.md" is always allowed.
- Editor is a plain `<textarea>` with a mono font. No CodeMirror, no external UI libraries. Tailwind only, dark-friendly neutral palette (`bg-neutral-950` / neutral text).
- UI copy in English. Code comments in English. All paths use forward slashes.
- Run all commands from repo root `C:\Users\richa\projects\skillsmith`.

---

### Task 1: Deps, Vitest/React wiring, and `lib/zip.ts`

**Files:**
- Edit: `package.json` (add `fflate` + 4 dev deps)
- Edit: `vitest.config.ts` (react plugin, widened include)
- Create: `lib/zip.ts`
- Test: `lib/zip.test.ts`

**Interfaces:**
- Consumes: `SkillFile` from `./skill-lint/model`, `fflate`
- Produces:
```ts
export function zipSkill(files: SkillFile[], rootDir: string): Uint8Array;
export function unzipSkill(data: Uint8Array): SkillFile[];
export function downloadBlob(filename: string, data: Uint8Array | string, mime: string): void;
```

- [ ] **Step 1: Add dependencies**

Run:
```bash
npm install fflate
npm install -D jsdom @testing-library/react @testing-library/user-event @vitejs/plugin-react
```
Expected: `package.json` now lists `fflate` under `dependencies` and the four packages under `devDependencies`; `npm install` completes clean.

- [ ] **Step 2: Wire the React plugin into Vitest**

Replace `vitest.config.ts` with:
```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    // Node by default (engine + pure libs). Component tests opt into jsdom
    // per-file with a `// @vitest-environment jsdom` pragma on line 1.
    environment: "node",
    include: ["lib/**/*.test.ts", "components/**/*.test.tsx", "app/**/*.test.tsx"],
  },
});
```

- [ ] **Step 3: Write the failing tests for `lib/zip.ts`**

`lib/zip.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { zipSkill, unzipSkill } from "./zip";
import type { SkillFile } from "./skill-lint/model";

const FILES: SkillFile[] = [
  { path: "SKILL.md", content: "---\nname: demo\ndescription: x\n---\nbody" },
  { path: "references/api.md", content: "reference content" },
];

describe("zipSkill / unzipSkill round trip", () => {
  it("prefixes entries with rootDir and restores them stripped", () => {
    const bytes = zipSkill(FILES, "demo");
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(0);
    const back = unzipSkill(bytes);
    const byPath = Object.fromEntries(back.map((f) => [f.path, f.content]));
    expect(new Set(Object.keys(byPath))).toEqual(new Set(["SKILL.md", "references/api.md"]));
    expect(byPath["SKILL.md"]).toBe(FILES[0].content);
    expect(byPath["references/api.md"]).toBe(FILES[1].content);
  });

  it("preserves UTF-8 content including CJK", () => {
    const cjk: SkillFile[] = [{ path: "SKILL.md", content: "研究深度研究文獻回顧檢索" }];
    const back = unzipSkill(zipSkill(cjk, "cjk-skill"));
    expect(back[0].content).toBe("研究深度研究文獻回顧檢索");
  });
});

describe("unzipSkill root handling", () => {
  it("strips a single shared root directory", () => {
    const bytes = zipSkill(FILES, "my-skill"); // entries: my-skill/SKILL.md, my-skill/references/api.md
    const back = unzipSkill(bytes);
    expect(back.map((f) => f.path).sort()).toEqual(["SKILL.md", "references/api.md"]);
  });

  it("does not strip when entries do not share one common root", () => {
    // Hand-build a two-root zip via zipSkill on already-rooted paths.
    const mixed: SkillFile[] = [
      { path: "a/SKILL.md", content: "1" },
      { path: "b/other.md", content: "2" },
    ];
    const bytes = zipSkill(mixed, ""); // rootDir "" → entries keep a/... and b/...
    const back = unzipSkill(bytes);
    expect(back.map((f) => f.path).sort()).toEqual(["a/SKILL.md", "b/other.md"]);
  });
});
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `npx vitest run lib/zip.test.ts`
Expected: FAIL — "Cannot find module './zip'".

- [ ] **Step 5: Implement `lib/zip.ts`**

```ts
import { zipSync, unzipSync, strToU8, strFromU8 } from "fflate";
import type { SkillFile } from "./skill-lint/model";

/** Zip a skill's virtual files. Every entry is prefixed with `${rootDir}/`. */
export function zipSkill(files: SkillFile[], rootDir: string): Uint8Array {
  const prefix = rootDir ? `${rootDir}/` : "";
  const entries: Record<string, Uint8Array> = {};
  for (const f of files) {
    entries[`${prefix}${f.path}`] = strToU8(f.content);
  }
  return zipSync(entries, { level: 6 });
}

/** Unzip into SkillFile[]. Directory entries are skipped and a single shared
 *  root directory (as produced by every download-as-zip) is stripped. */
export function unzipSkill(data: Uint8Array): SkillFile[] {
  const raw = unzipSync(data);
  const paths = Object.keys(raw)
    .map((p) => p.replace(/\\/g, "/"))
    .filter((p) => !p.endsWith("/")); // skip directory entries
  const root = commonRoot(paths);
  const files: SkillFile[] = [];
  for (const p of paths) {
    const rel = root ? p.slice(root.length + 1) : p;
    if (!rel) continue;
    files.push({ path: rel, content: strFromU8(raw[p.replace(/\//g, "/")] ?? raw[p]) });
  }
  return files;
}

/** The single top-level directory shared by every path, else "". */
function commonRoot(paths: string[]): string {
  if (paths.length === 0) return "";
  const seg = (p: string) => p.split("/")[0];
  const root = seg(paths[0]);
  return paths.every((p) => p.includes("/") && seg(p) === root) ? root : "";
}

/** Browser-only: trigger a file download from bytes or a string. */
export function downloadBlob(filename: string, data: Uint8Array | string, mime: string): void {
  const parts: BlobPart[] = [typeof data === "string" ? data : new Uint8Array(data)];
  const blob = new Blob(parts, { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
```

> Note: `unzipSkill` reads `raw[p]` after normalizing separators for `paths`; because fflate keys use forward slashes already, the lookup `raw[p]` is used directly — the `??` fallback guards the rare backslash case. Keep the simple `raw[p]` if you prefer; the fallback is harmless.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run lib/zip.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 7: Full suite + build must still pass**

Run: `npm test`
Expected: all engine tests plus `zip` green.
Run: `npm run build`
Expected: build succeeds, `out/index.html` exists.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(ui): fflate zip lib + Vitest React wiring"
```

---

### Task 2: `lib/handoff.ts` (sessionStorage hand-off)

**Files:**
- Create: `lib/handoff.ts`
- Test: `lib/handoff.test.ts`

**Interfaces:**
- Consumes: `SkillFile` from `./skill-lint/model`
- Produces:
```ts
export interface IncomingSkill { files: SkillFile[]; dirName?: string; source?: string }
export function stashIncomingSkill(
  files: SkillFile[],
  opts?: { dirName?: string; source?: string },
  storage?: Storage
): void;
export function takeIncomingSkill(storage?: Storage): IncomingSkill | null; // reads AND removes
```

- [ ] **Step 1: Write the failing tests**

`lib/handoff.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { stashIncomingSkill, takeIncomingSkill } from "./handoff";
import type { SkillFile } from "./skill-lint/model";

/** Minimal in-memory Storage stub so this stays a node test. */
function makeStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    key: (i: number) => Array.from(m.keys())[i] ?? null,
    removeItem: (k: string) => void m.delete(k),
    setItem: (k: string, v: string) => void m.set(k, v),
  } as Storage;
}

const FILES: SkillFile[] = [{ path: "SKILL.md", content: "---\nname: x\n---\nbody" }];

describe("stash / take incoming skill", () => {
  it("round-trips files, dirName and source", () => {
    const s = makeStorage();
    stashIncomingSkill(FILES, { dirName: "my-skill", source: "wizard" }, s);
    const got = takeIncomingSkill(s);
    expect(got).toEqual({ files: FILES, dirName: "my-skill", source: "wizard" });
  });

  it("removes the key after reading (single-use)", () => {
    const s = makeStorage();
    stashIncomingSkill(FILES, {}, s);
    expect(takeIncomingSkill(s)).not.toBeNull();
    expect(takeIncomingSkill(s)).toBeNull();
  });

  it("returns null when nothing was stashed", () => {
    expect(takeIncomingSkill(makeStorage())).toBeNull();
  });

  it("returns null and does not throw on corrupt JSON", () => {
    const s = makeStorage();
    s.setItem("skillsmith:incoming", "{not json");
    expect(() => takeIncomingSkill(s)).not.toThrow();
    expect(takeIncomingSkill(s)).toBeNull();
  });

  it("swallows quota errors on write (non-fatal)", () => {
    const throwing = {
      ...makeStorage(),
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    } as Storage;
    expect(() => stashIncomingSkill(FILES, {}, throwing)).not.toThrow();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run lib/handoff.test.ts`
Expected: FAIL — "Cannot find module './handoff'".

- [ ] **Step 3: Implement `lib/handoff.ts`**

```ts
import type { SkillFile } from "./skill-lint/model";

const KEY = "skillsmith:incoming";

export interface IncomingSkill {
  files: SkillFile[];
  dirName?: string;
  source?: string;
}

/** Default storage: the browser sessionStorage when present, else undefined (SSR/tests). */
function defaultStorage(): Storage | undefined {
  return typeof globalThis !== "undefined" &&
    (globalThis as { sessionStorage?: Storage }).sessionStorage
    ? (globalThis as unknown as { sessionStorage: Storage }).sessionStorage
    : undefined;
}

/** Stash a skill for the workspace to pick up after navigation. Plans 4/5 call this. */
export function stashIncomingSkill(
  files: SkillFile[],
  opts: { dirName?: string; source?: string } = {},
  storage: Storage | undefined = defaultStorage()
): void {
  if (!storage) return;
  try {
    const payload: IncomingSkill = { files, dirName: opts.dirName, source: opts.source };
    storage.setItem(KEY, JSON.stringify(payload));
  } catch (e) {
    console.warn("stashIncomingSkill: could not write sessionStorage", e);
  }
}

/** Read AND remove the stashed skill. Returns null when absent or corrupt. */
export function takeIncomingSkill(
  storage: Storage | undefined = defaultStorage()
): IncomingSkill | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(KEY);
    if (!raw) return null;
    storage.removeItem(KEY);
    const parsed = JSON.parse(raw) as IncomingSkill;
    if (!parsed || !Array.isArray(parsed.files)) return null;
    return parsed;
  } catch (e) {
    console.warn("takeIncomingSkill: could not read sessionStorage", e);
    return null;
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run lib/handoff.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/handoff.ts lib/handoff.test.ts
git commit -m "feat(ui): sessionStorage skill hand-off lib"
```

---

### Task 3: `useWorkspace` reducer + draft persistence

**Files:**
- Create: `components/workspace/demoSkill.ts`
- Create: `components/workspace/useWorkspace.ts`
- Test: `components/workspace/useWorkspace.test.ts`

**Interfaces:**
- Consumes: `lintSkill`, `SkillFile`, `Profile`, `Finding`, `LintOutcome` from `@/lib/skill-lint`; `takeIncomingSkill` from `@/lib/handoff`
- Produces:
```ts
export interface WorkspaceState { files: SkillFile[]; activePath: string; dirName?: string }
export type WorkspaceAction =
  | { type: "loadFiles"; files: SkillFile[]; dirName?: string }
  | { type: "editActive"; content: string }
  | { type: "selectFile"; path: string }
  | { type: "addFile"; path: string }
  | { type: "deleteFile"; path: string }
  | { type: "applyFix"; finding: Finding }
  | { type: "reset" };
export function workspaceReducer(state: WorkspaceState, action: WorkspaceAction): WorkspaceState; // exported for tests
export function useWorkspace(profile: Profile): {
  state: WorkspaceState;
  dispatch: React.Dispatch<WorkspaceAction>;
  outcome: LintOutcome;
};
```

> Ambiguity resolved: the spec's `useWorkspace` action list names loadFiles/editActive/selectFile/applyFix/reset; the file-tree UI (Task 5) also needs add/delete, so `addFile`/`deleteFile` are included here as natural reducer transitions. `deleteFile` refuses to remove `SKILL.md` (the required entry file).

- [ ] **Step 1: Write the demo starter skill**

`components/workspace/demoSkill.ts`:
```ts
import type { SkillFile } from "@/lib/skill-lint";

/** Deterministic starter shown on first visit and by "Start from template".
 *  name === dirName ("my-first-skill") so it scores clean out of the box. */
export const DEMO_DIR_NAME = "my-first-skill";

export const DEMO_SKILL: SkillFile[] = [
  {
    path: "SKILL.md",
    content: `---
name: my-first-skill
description: Use when the user wants a starting point for authoring a Claude Agent Skill; provides a minimal, valid SKILL.md skeleton to edit and extend.
---

# My First Skill

Replace this body with instructions for the agent. Keep it short — move long
reference material into a \`references/\` file so it costs zero tokens until read.

## When to use

Describe the concrete situations that should trigger this skill.

## Steps

1. Explain the first step.
2. Explain the second step.
`,
  },
];
```

- [ ] **Step 2: Write the failing tests (reducer only — pure, node env)**

`components/workspace/useWorkspace.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { workspaceReducer, type WorkspaceState } from "./useWorkspace";
import type { Finding, SkillFile } from "@/lib/skill-lint";

const base: WorkspaceState = {
  files: [
    { path: "SKILL.md", content: "---\nname: demo\ndescription: x\n---\nbody" },
    { path: "references/api.md", content: "ref" },
  ],
  activePath: "SKILL.md",
  dirName: "demo",
};

describe("workspaceReducer", () => {
  it("loadFiles replaces files, dirName and picks SKILL.md active", () => {
    const next = workspaceReducer(base, {
      type: "loadFiles",
      files: [{ path: "SKILL.md", content: "new" }],
      dirName: "other",
    });
    expect(next.files).toHaveLength(1);
    expect(next.dirName).toBe("other");
    expect(next.activePath).toBe("SKILL.md");
  });

  it("editActive only mutates the active file", () => {
    const next = workspaceReducer(base, { type: "editActive", content: "edited" });
    expect(next.files.find((f) => f.path === "SKILL.md")!.content).toBe("edited");
    expect(next.files.find((f) => f.path === "references/api.md")!.content).toBe("ref");
  });

  it("selectFile switches active only to an existing path", () => {
    expect(workspaceReducer(base, { type: "selectFile", path: "references/api.md" }).activePath).toBe(
      "references/api.md"
    );
    expect(workspaceReducer(base, { type: "selectFile", path: "nope.md" }).activePath).toBe("SKILL.md");
  });

  it("addFile appends a blank file and focuses it; ignores dupes/blank", () => {
    const added = workspaceReducer(base, { type: "addFile", path: "scripts/run.py" });
    expect(added.files.map((f) => f.path)).toContain("scripts/run.py");
    expect(added.activePath).toBe("scripts/run.py");
    expect(workspaceReducer(base, { type: "addFile", path: "SKILL.md" }).files).toHaveLength(2);
    expect(workspaceReducer(base, { type: "addFile", path: "  " }).files).toHaveLength(2);
  });

  it("deleteFile removes a file but never SKILL.md, and refocuses", () => {
    const del = workspaceReducer(
      { ...base, activePath: "references/api.md" },
      { type: "deleteFile", path: "references/api.md" }
    );
    expect(del.files.map((f) => f.path)).toEqual(["SKILL.md"]);
    expect(del.activePath).toBe("SKILL.md");
    expect(workspaceReducer(base, { type: "deleteFile", path: "SKILL.md" }).files).toHaveLength(2);
  });

  it("applyFix runs finding.fix.apply and replaces files", () => {
    const files: SkillFile[] = [{ path: "SKILL.md", content: "old" }];
    const finding = {
      ruleId: "E12",
      severity: "error",
      message: "m",
      why: "w",
      howToFix: "h",
      fix: { label: "Quote it", apply: (fs: SkillFile[]) => fs.map((f) => ({ ...f, content: "fixed" })) },
    } as Finding;
    const next = workspaceReducer({ files, activePath: "SKILL.md" }, { type: "applyFix", finding });
    expect(next.files[0].content).toBe("fixed");
  });

  it("applyFix is a no-op when the finding has no fix", () => {
    const finding = { ruleId: "W07", severity: "warning", message: "m", why: "w", howToFix: "h" } as Finding;
    const next = workspaceReducer(base, { type: "applyFix", finding });
    expect(next).toBe(base);
  });

  it("reset returns the demo starter", () => {
    const next = workspaceReducer(base, { type: "reset" });
    expect(next.files.some((f) => f.path === "SKILL.md")).toBe(true);
    expect(next.dirName).toBe("my-first-skill");
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run components/workspace/useWorkspace.test.ts`
Expected: FAIL — "Cannot find module './useWorkspace'".

- [ ] **Step 4: Implement `components/workspace/useWorkspace.ts`**

```ts
"use client";

import { useEffect, useMemo, useReducer, useState } from "react";
import {
  lintSkill,
  type Finding,
  type LintOutcome,
  type Profile,
  type SkillFile,
} from "@/lib/skill-lint";
import { takeIncomingSkill } from "@/lib/handoff";
import { DEMO_DIR_NAME, DEMO_SKILL } from "./demoSkill";

const DRAFT_KEY = "skillsmith:draft";

export interface WorkspaceState {
  files: SkillFile[];
  activePath: string;
  dirName?: string;
}

export type WorkspaceAction =
  | { type: "loadFiles"; files: SkillFile[]; dirName?: string }
  | { type: "editActive"; content: string }
  | { type: "selectFile"; path: string }
  | { type: "addFile"; path: string }
  | { type: "deleteFile"; path: string }
  | { type: "applyFix"; finding: Finding }
  | { type: "reset" };

function pickActive(files: SkillFile[], preferred: string): string {
  if (preferred && files.some((f) => f.path === preferred)) return preferred;
  if (files.some((f) => f.path === "SKILL.md")) return "SKILL.md";
  return files[0]?.path ?? "";
}

function initialState(): WorkspaceState {
  return { files: DEMO_SKILL, activePath: "SKILL.md", dirName: DEMO_DIR_NAME };
}

export function workspaceReducer(state: WorkspaceState, action: WorkspaceAction): WorkspaceState {
  switch (action.type) {
    case "loadFiles": {
      const files = action.files.length > 0 ? action.files : state.files;
      return { files, activePath: pickActive(files, ""), dirName: action.dirName };
    }
    case "editActive": {
      const files = state.files.map((f) =>
        f.path === state.activePath ? { ...f, content: action.content } : f
      );
      return { ...state, files };
    }
    case "selectFile":
      return state.files.some((f) => f.path === action.path)
        ? { ...state, activePath: action.path }
        : state;
    case "addFile": {
      const path = action.path.trim().replace(/\\/g, "/");
      if (!path || state.files.some((f) => f.path === path)) return state;
      const files = [...state.files, { path, content: "" }];
      return { ...state, files, activePath: path };
    }
    case "deleteFile": {
      if (action.path === "SKILL.md") return state; // required entry file
      const files = state.files.filter((f) => f.path !== action.path);
      if (files.length === state.files.length) return state;
      const activePath = state.activePath === action.path ? pickActive(files, "") : state.activePath;
      return { ...state, files, activePath };
    }
    case "applyFix": {
      if (!action.finding.fix) return state;
      const files = action.finding.fix.apply(state.files);
      return { ...state, files, activePath: pickActive(files, state.activePath) };
    }
    case "reset":
      return initialState();
    default:
      return state;
  }
}

/** Restore an incoming hand-off, then a saved draft, else null. Client-only. */
function restore(): { files: SkillFile[]; dirName?: string } | null {
  const incoming = takeIncomingSkill();
  if (incoming && incoming.files.length > 0) {
    return { files: incoming.files, dirName: incoming.dirName };
  }
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw) as { files: SkillFile[]; dirName?: string };
    if (draft && Array.isArray(draft.files) && draft.files.length > 0) {
      return { files: draft.files, dirName: draft.dirName };
    }
  } catch (e) {
    console.warn("useWorkspace: could not read draft", e);
  }
  return null;
}

export function useWorkspace(profile: Profile) {
  // Server + first client render use the deterministic demo (no hydration mismatch).
  const [state, dispatch] = useReducer(workspaceReducer, undefined, initialState);
  const [hydrated, setHydrated] = useState(false);

  // After mount: pull an incoming skill or a saved draft (spec §3).
  useEffect(() => {
    const restored = restore();
    if (restored) dispatch({ type: "loadFiles", files: restored.files, dirName: restored.dirName });
    setHydrated(true);
  }, []);

  // Persist the draft (300 ms debounce), only after the initial restore. Non-fatal on quota (§11).
  useEffect(() => {
    if (!hydrated) return;
    const id = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ files: state.files, dirName: state.dirName }));
      } catch (e) {
        console.warn("useWorkspace: could not save draft", e);
      }
    }, 300);
    return () => clearTimeout(id);
  }, [state.files, state.dirName, hydrated]);

  // Engine is <5 ms — no debounce needed. Recompute on files/profile/dirName change.
  const outcome: LintOutcome = useMemo(
    () => lintSkill(state.files, { profile, dirName: state.dirName }),
    [state.files, profile, state.dirName]
  );

  return { state, dispatch, outcome };
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run components/workspace/useWorkspace.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 6: Commit**

```bash
git add components/workspace/demoSkill.ts components/workspace/useWorkspace.ts components/workspace/useWorkspace.test.ts
git commit -m "feat(ui): useWorkspace reducer with draft persistence"
```

---

### Task 4: Findings panel + Tokens panel

**Files:**
- Create: `components/workspace/FindingsPanel.tsx`
- Create: `components/workspace/TokensPanel.tsx`
- Test: `components/workspace/FindingsPanel.test.tsx`
- Test: `components/workspace/TokensPanel.test.tsx`

**Interfaces:**
- Consumes: `Finding`, `Severity`, `TokenReport` from `@/lib/skill-lint`
- Produces:
```ts
export function FindingsPanel(props: { findings: Finding[]; onApplyFix: (f: Finding) => void }): JSX.Element;
export function TokensPanel(props: { tokens: TokenReport }): JSX.Element;
```

- [ ] **Step 1: Implement `components/workspace/FindingsPanel.tsx`**

```tsx
"use client";

import type { Finding, Severity } from "@/lib/skill-lint";

const SEVERITY_META: Record<Severity, { label: string; dot: string; badge: string }> = {
  error: { label: "Errors", dot: "bg-red-500", badge: "border-red-500/30 bg-red-500/15 text-red-300" },
  warning: { label: "Warnings", dot: "bg-amber-500", badge: "border-amber-500/30 bg-amber-500/15 text-amber-300" },
  suggestion: { label: "Suggestions", dot: "bg-sky-500", badge: "border-sky-500/30 bg-sky-500/15 text-sky-300" },
};

const ORDER: Severity[] = ["error", "warning", "suggestion"];

export function FindingsPanel({
  findings,
  onApplyFix,
}: {
  findings: Finding[];
  onApplyFix: (finding: Finding) => void;
}) {
  if (findings.length === 0) {
    return (
      <div className="p-6 text-sm text-neutral-400">
        No findings. This skill passes every enabled rule.
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-5 p-3">
      {ORDER.map((sev) => {
        const group = findings.filter((f) => f.severity === sev);
        if (group.length === 0) return null;
        const meta = SEVERITY_META[sev];
        return (
          <section key={sev}>
            <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
              <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
              {meta.label}
              <span className={`rounded-full border px-1.5 py-0.5 text-[10px] ${meta.badge}`}>{group.length}</span>
            </h3>
            <ul className="flex flex-col gap-2">
              {group.map((f, i) => (
                <li
                  key={`${f.ruleId}-${i}`}
                  className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-3"
                >
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-neutral-800 px-1.5 py-0.5 font-mono text-[11px] text-neutral-300">
                      {f.ruleId}
                    </span>
                    {typeof f.line === "number" && (
                      <span className="font-mono text-[11px] text-neutral-500">L{f.line}</span>
                    )}
                    {f.file && f.file !== "SKILL.md" && (
                      <span className="font-mono text-[11px] text-neutral-500">{f.file}</span>
                    )}
                    {f.fix && (
                      <button
                        type="button"
                        onClick={() => onApplyFix(f)}
                        className="ml-auto rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-300 hover:bg-emerald-500/20"
                      >
                        {f.fix.label || "Apply fix"}
                      </button>
                    )}
                  </div>
                  <p className="mt-2 text-sm text-neutral-100">{f.message}</p>
                  <details className="mt-1 text-sm text-neutral-400">
                    <summary className="cursor-pointer select-none text-xs text-neutral-500 hover:text-neutral-300">
                      Why it matters &amp; how to fix
                    </summary>
                    <p className="mt-2">
                      <span className="font-medium text-neutral-300">Why: </span>
                      {f.why}
                    </p>
                    <p className="mt-1">
                      <span className="font-medium text-neutral-300">Fix: </span>
                      {f.howToFix}
                    </p>
                  </details>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Implement `components/workspace/TokensPanel.tsx`**

```tsx
"use client";

import type { TokenReport } from "@/lib/skill-lint";

interface Row {
  key: string;
  label: string;
  value: number;
  unit: "tokens" | "files";
  note: string;
}

export function TokensPanel({ tokens }: { tokens: TokenReport }) {
  const rows: Row[] = [
    {
      key: "metadata",
      label: "Metadata (name + description)",
      value: tokens.metadata,
      unit: "tokens",
      note: "Loaded into every conversation — the most expensive tokens you own.",
    },
    {
      key: "body",
      label: "SKILL.md body",
      value: tokens.body,
      unit: "tokens",
      note: "Loaded only when the skill triggers.",
    },
    {
      key: "references",
      label: "references/ files",
      value: tokens.references,
      unit: "tokens",
      note: "Zero cost until the agent opens them — moving content here is free.",
    },
    {
      key: "scripts",
      label: "scripts/ files",
      value: tokens.scriptFiles,
      unit: "files",
      note: "Executed, never loaded — only their output consumes context.",
    },
  ];
  const maxTokens = Math.max(1, tokens.metadata, tokens.body, tokens.references);

  return (
    <div className="flex flex-col gap-4 p-4">
      <p className="text-xs text-neutral-500">
        ~estimated — Anthropic does not publish the Claude 3+ tokenizer, so these are heuristic counts.
      </p>
      <ul className="flex flex-col gap-4">
        {rows.map((r) => {
          const pct = r.unit === "tokens" ? Math.round((r.value / maxTokens) * 100) : 0;
          return (
            <li key={r.key}>
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-neutral-200">{r.label}</span>
                <span className="font-mono text-neutral-400">
                  {r.value} {r.unit === "tokens" ? "tok" : r.value === 1 ? "file" : "files"}
                </span>
              </div>
              {r.unit === "tokens" && (
                <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-neutral-800">
                  <div className="h-full rounded-full bg-sky-500" style={{ width: `${pct}%` }} />
                </div>
              )}
              <p className="mt-1 text-xs text-neutral-500">{r.note}</p>
            </li>
          );
        })}
      </ul>
      <div className="flex items-baseline justify-between border-t border-neutral-800 pt-3 text-sm">
        <span className="font-medium text-neutral-100">Total context (metadata + body + references)</span>
        <span className="font-mono text-neutral-200">{tokens.total} tok</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Write and run the component smoke tests**

`components/workspace/FindingsPanel.test.tsx`:
```tsx
// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { FindingsPanel } from "./FindingsPanel";
import type { Finding } from "@/lib/skill-lint";

afterEach(cleanup);

const findings: Finding[] = [
  { ruleId: "E02", severity: "error", message: "name is not kebab-case", why: "w", howToFix: "h" },
  {
    ruleId: "E12",
    severity: "error",
    message: "unquoted colon",
    why: "w",
    howToFix: "h",
    fix: { label: "Quote it", apply: (fs) => fs },
  },
  { ruleId: "W07", severity: "warning", message: "generic name", why: "w", howToFix: "h" },
];

describe("FindingsPanel", () => {
  it("renders grouped severities with counts and rule chips", () => {
    render(<FindingsPanel findings={findings} onApplyFix={() => {}} />);
    expect(screen.getByText("Errors")).toBeTruthy();
    expect(screen.getByText("Warnings")).toBeTruthy();
    expect(screen.getByText("E02")).toBeTruthy();
    expect(screen.getByText("W07")).toBeTruthy();
  });

  it("fires onApplyFix when the fix button is clicked", () => {
    const onApplyFix = vi.fn();
    render(<FindingsPanel findings={findings} onApplyFix={onApplyFix} />);
    fireEvent.click(screen.getByRole("button", { name: "Quote it" }));
    expect(onApplyFix).toHaveBeenCalledTimes(1);
    expect(onApplyFix.mock.calls[0][0].ruleId).toBe("E12");
  });

  it("shows the empty state with no findings", () => {
    render(<FindingsPanel findings={[]} onApplyFix={() => {}} />);
    expect(screen.getByText(/passes every enabled rule/i)).toBeTruthy();
  });
});
```

`components/workspace/TokensPanel.test.tsx`:
```tsx
// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { TokensPanel } from "./TokensPanel";
import type { TokenReport } from "@/lib/skill-lint";

afterEach(cleanup);

const tokens: TokenReport = { metadata: 30, body: 120, references: 80, scriptFiles: 2, total: 230 };

describe("TokensPanel", () => {
  it("renders the four progressive-disclosure rows and the total", () => {
    render(<TokensPanel tokens={tokens} />);
    expect(screen.getByText(/Metadata \(name \+ description\)/)).toBeTruthy();
    expect(screen.getByText("SKILL.md body")).toBeTruthy();
    expect(screen.getByText("references/ files")).toBeTruthy();
    expect(screen.getByText("scripts/ files")).toBeTruthy();
    expect(screen.getByText("230 tok")).toBeTruthy();
  });

  it("labels the estimate as approximate", () => {
    render(<TokensPanel tokens={tokens} />);
    expect(screen.getByText(/~estimated/)).toBeTruthy();
  });
});
```

Run: `npx vitest run components/workspace/FindingsPanel.test.tsx components/workspace/TokensPanel.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 4: Commit**

```bash
git add components/workspace/FindingsPanel.tsx components/workspace/TokensPanel.tsx components/workspace/FindingsPanel.test.tsx components/workspace/TokensPanel.test.tsx
git commit -m "feat(ui): findings and tokens panels"
```

---

### Task 5: File tree, editor, score badge, profile select, export buttons

**Files:**
- Create: `components/workspace/ScoreBadge.tsx`
- Create: `components/workspace/ProfileSelect.tsx`
- Create: `components/workspace/ExportButtons.tsx`
- Create: `components/workspace/FileTree.tsx`
- Create: `components/workspace/Editor.tsx`
- Test: `components/workspace/ExportButtons.test.tsx`
- Test: `components/workspace/FileTree.test.tsx`

**Interfaces:**
- Consumes: `ScoreResult`, `Profile`, `SkillFile` from `@/lib/skill-lint`; `zipSkill`, `downloadBlob` from `@/lib/zip`
- Produces:
```ts
export function ScoreBadge(props: { score: ScoreResult }): JSX.Element;
export function ProfileSelect(props: { value: Profile; onChange: (p: Profile) => void }): JSX.Element;
export function ExportButtons(props: {
  files: SkillFile[]; dirName?: string; skillName?: string; hasError: boolean;
}): JSX.Element;
export function FileTree(props: {
  files: SkillFile[]; activePath: string;
  onSelect: (p: string) => void; onAdd: (p: string) => void; onDelete: (p: string) => void;
}): JSX.Element;
export function Editor(props: { file: SkillFile | undefined; onChange: (content: string) => void }): JSX.Element;
```

- [ ] **Step 1: Implement `components/workspace/ScoreBadge.tsx`**

```tsx
import type { ScoreResult } from "@/lib/skill-lint";

const BAND: Record<ScoreResult["band"], { label: string; cls: string }> = {
  excellent: { label: "Excellent", cls: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" },
  good: { label: "Good", cls: "border-sky-500/40 bg-sky-500/10 text-sky-300" },
  "needs-work": { label: "Needs work", cls: "border-amber-500/40 bg-amber-500/10 text-amber-300" },
  poor: { label: "Poor", cls: "border-red-500/40 bg-red-500/10 text-red-300" },
};

export function ScoreBadge({ score }: { score: ScoreResult }) {
  const band = BAND[score.band];
  return (
    <div
      className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 ${band.cls}`}
      title={`Score ${score.value}/100 — ${band.label}`}
    >
      <span className="text-lg font-bold tabular-nums">{score.value}</span>
      <span className="text-xs font-medium uppercase tracking-wide">{band.label}</span>
    </div>
  );
}
```

- [ ] **Step 2: Implement `components/workspace/ProfileSelect.tsx`**

```tsx
"use client";

import type { Profile } from "@/lib/skill-lint";

export function ProfileSelect({ value, onChange }: { value: Profile; onChange: (p: Profile) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm text-neutral-400">
      <span className="hidden sm:inline">Profile</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as Profile)}
        aria-label="Lint profile"
        className="rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm text-neutral-100"
      >
        <option value="generic">Generic (agentskills.io)</option>
        <option value="claude-code-plugin">Claude Code plugin</option>
      </select>
    </label>
  );
}
```

- [ ] **Step 3: Implement `components/workspace/ExportButtons.tsx`**

```tsx
"use client";

import { useState } from "react";
import type { SkillFile } from "@/lib/skill-lint";
import { downloadBlob, zipSkill } from "@/lib/zip";

function btnCls(disabled: boolean): string {
  return `rounded-md border px-3 py-1.5 text-sm font-medium ${
    disabled
      ? "cursor-not-allowed border-neutral-800 bg-neutral-900 text-neutral-600"
      : "border-neutral-700 bg-neutral-800 text-neutral-100 hover:bg-neutral-700"
  }`;
}

export function ExportButtons({
  files,
  dirName,
  skillName,
  hasError,
}: {
  files: SkillFile[];
  dirName?: string;
  skillName?: string;
  hasError: boolean;
}) {
  const dir = ((dirName || skillName || "skill").trim() || "skill").replace(/[^a-zA-Z0-9._-]/g, "-");
  const [copied, setCopied] = useState(false);

  function onZip() {
    downloadBlob(`${dir}.zip`, zipSkill(files, dir), "application/zip");
  }
  function onSkill() {
    // A .skill file is a plain zip renamed (official format).
    downloadBlob(`${dir}.skill`, zipSkill(files, dir), "application/zip");
  }
  async function onCopy() {
    const skill = files.find((f) => f.path === "SKILL.md");
    if (!skill) return;
    try {
      await navigator.clipboard.writeText(skill.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      console.warn("ExportButtons: clipboard write failed", e);
    }
  }

  const gateTitle = hasError ? "Fix every error before exporting a package" : undefined;
  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={onZip} disabled={hasError} title={gateTitle} className={btnCls(hasError)}>
        Download .zip
      </button>
      <button type="button" onClick={onSkill} disabled={hasError} title={gateTitle} className={btnCls(hasError)}>
        Download .skill
      </button>
      <button type="button" onClick={onCopy} className={btnCls(false)}>
        {copied ? "Copied!" : "Copy SKILL.md"}
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Implement `components/workspace/FileTree.tsx`**

```tsx
"use client";

import { useState } from "react";
import type { SkillFile } from "@/lib/skill-lint";

export function FileTree({
  files,
  activePath,
  onSelect,
  onAdd,
  onDelete,
}: {
  files: SkillFile[];
  activePath: string;
  onSelect: (path: string) => void;
  onAdd: (path: string) => void;
  onDelete: (path: string) => void;
}) {
  const [draft, setDraft] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const path = draft.trim();
    if (!path) return;
    onAdd(path);
    setDraft("");
  }

  return (
    <div className="flex h-full flex-col">
      <ul className="flex-1 overflow-auto p-2">
        {[...files]
          .sort((a, b) => a.path.localeCompare(b.path))
          .map((f) => (
            <li key={f.path} className="group flex items-center">
              <button
                type="button"
                onClick={() => onSelect(f.path)}
                className={`flex-1 truncate rounded px-2 py-1 text-left font-mono text-xs ${
                  f.path === activePath
                    ? "bg-neutral-800 text-neutral-100"
                    : "text-neutral-400 hover:bg-neutral-900"
                }`}
              >
                {f.path}
              </button>
              {f.path !== "SKILL.md" && (
                <button
                  type="button"
                  aria-label={`Delete ${f.path}`}
                  onClick={() => onDelete(f.path)}
                  className="ml-1 px-1 text-neutral-600 opacity-0 hover:text-red-400 group-hover:opacity-100"
                >
                  ×
                </button>
              )}
            </li>
          ))}
      </ul>
      <form onSubmit={submit} className="border-t border-neutral-800 p-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="add file e.g. references/api.md"
          aria-label="New file path"
          className="w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1 font-mono text-xs text-neutral-100 placeholder:text-neutral-600"
        />
      </form>
    </div>
  );
}
```

- [ ] **Step 5: Implement `components/workspace/Editor.tsx`**

```tsx
"use client";

import type { SkillFile } from "@/lib/skill-lint";

export function Editor({
  file,
  onChange,
}: {
  file: SkillFile | undefined;
  onChange: (content: string) => void;
}) {
  if (!file) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-neutral-500">
        No file selected.
      </div>
    );
  }
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-neutral-800 px-3 py-1.5 font-mono text-xs text-neutral-500">
        {file.path}
      </div>
      <textarea
        value={file.content}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        aria-label={`Editor for ${file.path}`}
        className="w-full flex-1 resize-none bg-neutral-950 p-4 font-mono text-sm leading-relaxed text-neutral-100 outline-none"
      />
    </div>
  );
}
```

- [ ] **Step 6: Write and run tests**

`components/workspace/ExportButtons.test.tsx`:
```tsx
// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ExportButtons } from "./ExportButtons";
import type { SkillFile } from "@/lib/skill-lint";

afterEach(cleanup);

const files: SkillFile[] = [{ path: "SKILL.md", content: "---\nname: demo\n---\nbody" }];

describe("ExportButtons export gate", () => {
  it("disables package downloads when an error exists; copy stays enabled", () => {
    render(<ExportButtons files={files} dirName="demo" hasError={true} />);
    expect((screen.getByRole("button", { name: "Download .zip" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Download .skill" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Copy SKILL.md" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("enables package downloads with no errors", () => {
    render(<ExportButtons files={files} dirName="demo" hasError={false} />);
    expect((screen.getByRole("button", { name: "Download .zip" }) as HTMLButtonElement).disabled).toBe(false);
  });
});
```

`components/workspace/FileTree.test.tsx`:
```tsx
// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { FileTree } from "./FileTree";
import type { SkillFile } from "@/lib/skill-lint";

afterEach(cleanup);

const files: SkillFile[] = [
  { path: "SKILL.md", content: "a" },
  { path: "references/api.md", content: "b" },
];

describe("FileTree", () => {
  it("selects a file on click", () => {
    const onSelect = vi.fn();
    render(<FileTree files={files} activePath="SKILL.md" onSelect={onSelect} onAdd={() => {}} onDelete={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "references/api.md" }));
    expect(onSelect).toHaveBeenCalledWith("references/api.md");
  });

  it("adds a file via the input form", () => {
    const onAdd = vi.fn();
    render(<FileTree files={files} activePath="SKILL.md" onSelect={() => {}} onAdd={onAdd} onDelete={() => {}} />);
    const input = screen.getByLabelText("New file path");
    fireEvent.change(input, { target: { value: "scripts/run.py" } });
    fireEvent.submit(input);
    expect(onAdd).toHaveBeenCalledWith("scripts/run.py");
  });

  it("deletes a non-entry file and never offers to delete SKILL.md", () => {
    const onDelete = vi.fn();
    render(<FileTree files={files} activePath="SKILL.md" onSelect={() => {}} onAdd={() => {}} onDelete={onDelete} />);
    expect(screen.queryByLabelText("Delete SKILL.md")).toBeNull();
    fireEvent.click(screen.getByLabelText("Delete references/api.md"));
    expect(onDelete).toHaveBeenCalledWith("references/api.md");
  });
});
```

Run: `npx vitest run components/workspace/ExportButtons.test.tsx components/workspace/FileTree.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 7: Commit**

```bash
git add components/workspace/ScoreBadge.tsx components/workspace/ProfileSelect.tsx components/workspace/ExportButtons.tsx components/workspace/FileTree.tsx components/workspace/Editor.tsx components/workspace/ExportButtons.test.tsx components/workspace/FileTree.test.tsx
git commit -m "feat(ui): file tree, editor, score badge, profile select, export"
```

---

### Task 6: Workspace page assembly + analyze entries + not-a-skill panel

**Files:**
- Create: `components/AnalyzeEntry.tsx`
- Create: `components/workspace/NotASkillPanel.tsx`
- Create: `app/workspace/page.tsx`
- Test: `app/workspace/page.test.tsx`

**Interfaces:**
- Consumes: all Task 3–5 components, `useWorkspace`, `unzipSkill` from `@/lib/zip`, engine types
- Produces:
```ts
export interface AnalyzeResult { files: SkillFile[]; dirName?: string }
export function AnalyzeEntry(props: { onSkill: (r: AnalyzeResult) => void }): JSX.Element;
export function NotASkillPanel(props: { reason: string; onStartTemplate: () => void }): JSX.Element;
export default function WorkspacePage(): JSX.Element;
```

- [ ] **Step 1: Implement `components/AnalyzeEntry.tsx`**

```tsx
"use client";

import { useRef, useState } from "react";
import type { SkillFile } from "@/lib/skill-lint";
import { unzipSkill } from "@/lib/zip";

const MAX_FILE_BYTES = 2 * 1024 * 1024; // spec §11

export interface AnalyzeResult {
  files: SkillFile[];
  dirName?: string;
}

/** The single top-level directory shared by every path, else "". */
function commonRoot(paths: string[]): string {
  if (paths.length === 0) return "";
  const seg = (p: string) => p.split("/")[0];
  const root = seg(paths[0]);
  return paths.every((p) => p.includes("/") && seg(p) === root) ? root : "";
}

function rootFromArchiveName(name: string): string | undefined {
  const base = name.replace(/\.(zip|skill)$/i, "").trim();
  return base || undefined;
}

export function AnalyzeEntry({ onSkill }: { onSkill: (result: AnalyzeResult) => void }) {
  const [paste, setPaste] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dirInputRef = useRef<HTMLInputElement | null>(null);

  function submitPaste() {
    if (!paste.trim()) return;
    setError(null);
    onSkill({ files: [{ path: "SKILL.md", content: paste }] });
  }

  async function readPlainFiles(list: File[]): Promise<AnalyzeResult & { rejected: number }> {
    let rejected = 0;
    const raw: { path: string; content: string }[] = [];
    for (const file of list) {
      if (file.size > MAX_FILE_BYTES) {
        rejected++;
        continue;
      }
      const rel =
        (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
      raw.push({ path: rel.replace(/\\/g, "/"), content: await file.text() });
    }
    const root = commonRoot(raw.map((r) => r.path));
    const files = raw.map((r) => ({ path: root ? r.path.slice(root.length + 1) : r.path, content: r.content }));
    return { files, dirName: root || undefined, rejected };
  }

  async function handleFiles(list: FileList | null) {
    setError(null);
    if (!list || list.length === 0) return;
    const arr = Array.from(list);

    // Single .zip / .skill → unzip.
    if (arr.length === 1 && /\.(zip|skill)$/i.test(arr[0].name)) {
      if (arr[0].size > MAX_FILE_BYTES) {
        setError("That archive is over 2 MB.");
        return;
      }
      try {
        const bytes = new Uint8Array(await arr[0].arrayBuffer());
        const files = unzipSkill(bytes);
        if (files.length === 0) {
          setError("That archive contained no readable files.");
          return;
        }
        onSkill({ files, dirName: rootFromArchiveName(arr[0].name) });
      } catch (e) {
        setError("Could not read that archive.");
        console.warn(e);
      }
      return;
    }

    // Directory / loose files.
    try {
      const { files, dirName, rejected } = await readPlainFiles(arr);
      if (files.length === 0) {
        setError(rejected > 0 ? "Every file was over 2 MB." : "No readable files found.");
        return;
      }
      if (rejected > 0) setError(`Skipped ${rejected} file(s) over 2 MB.`);
      onSkill({ files, dirName });
    } catch (e) {
      setError("Could not read those files.");
      console.warn(e);
    }
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="flex flex-col">
        <label htmlFor="analyze-paste" className="mb-1 text-sm font-medium text-neutral-300">
          Paste a SKILL.md
        </label>
        <textarea
          id="analyze-paste"
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
          placeholder={"---\nname: my-skill\ndescription: Use when …\n---\n# Body"}
          className="h-40 w-full resize-none rounded-lg border border-neutral-800 bg-neutral-950 p-3 font-mono text-xs text-neutral-100 outline-none placeholder:text-neutral-600"
        />
        <button
          type="button"
          onClick={submitPaste}
          disabled={!paste.trim()}
          className="mt-2 self-start rounded-md border border-sky-500/40 bg-sky-500/10 px-3 py-1.5 text-sm font-medium text-sky-300 hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Analyze
        </button>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void handleFiles(e.dataTransfer.files);
        }}
        className={`flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-6 text-center ${
          dragging ? "border-sky-500 bg-sky-500/5" : "border-neutral-700"
        }`}
      >
        <p className="text-sm text-neutral-400">Drop a folder or a .zip / .skill here, or</p>
        <div className="flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-md border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-sm text-neutral-100 hover:bg-neutral-700"
          >
            Choose files / archive
          </button>
          <button
            type="button"
            onClick={() => dirInputRef.current?.click()}
            className="rounded-md border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-sm text-neutral-100 hover:bg-neutral-700"
          >
            Choose folder
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          aria-label="Upload files or archive"
          onChange={(e) => void handleFiles(e.target.files)}
        />
        <input
          ref={dirInputRef}
          type="file"
          multiple
          className="hidden"
          aria-label="Upload folder"
          // webkitdirectory is a non-standard attribute not in the React types.
          // @ts-expect-error non-standard attribute
          webkitdirectory=""
          onChange={(e) => void handleFiles(e.target.files)}
        />
        {error && <p className="text-xs text-amber-400">{error}</p>}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Implement `components/workspace/NotASkillPanel.tsx`**

```tsx
"use client";

export function NotASkillPanel({
  reason,
  onStartTemplate,
}: {
  reason: string;
  onStartTemplate: () => void;
}) {
  return (
    <div className="flex flex-1 items-center justify-center p-8 text-center">
      <div className="max-w-md rounded-xl border border-amber-500/30 bg-amber-500/5 p-6">
        <h2 className="text-lg font-semibold text-amber-200">This doesn&apos;t look like a skill</h2>
        <p className="mt-2 text-sm text-neutral-300">{reason}</p>
        <button
          type="button"
          onClick={onStartTemplate}
          className="mt-4 rounded-md border border-neutral-700 bg-neutral-800 px-4 py-2 text-sm text-neutral-100 hover:bg-neutral-700"
        >
          Start from template
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Implement `app/workspace/page.tsx`**

```tsx
"use client";

import { useState } from "react";
import type { Profile } from "@/lib/skill-lint";
import { useWorkspace } from "@/components/workspace/useWorkspace";
import { FindingsPanel } from "@/components/workspace/FindingsPanel";
import { TokensPanel } from "@/components/workspace/TokensPanel";
import { FileTree } from "@/components/workspace/FileTree";
import { Editor } from "@/components/workspace/Editor";
import { ScoreBadge } from "@/components/workspace/ScoreBadge";
import { ProfileSelect } from "@/components/workspace/ProfileSelect";
import { ExportButtons } from "@/components/workspace/ExportButtons";
import { NotASkillPanel } from "@/components/workspace/NotASkillPanel";
import { AnalyzeEntry } from "@/components/AnalyzeEntry";

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium ${
        active ? "border-b-2 border-sky-500 text-neutral-100" : "text-neutral-400 hover:text-neutral-200"
      }`}
    >
      {children}
    </button>
  );
}

export default function WorkspacePage() {
  const [profile, setProfile] = useState<Profile>("generic");
  const [tab, setTab] = useState<"findings" | "tokens">("findings");
  const [showOpen, setShowOpen] = useState(false);
  const { state, dispatch, outcome } = useWorkspace(profile);

  const activeFile = state.files.find((f) => f.path === state.activePath);
  const skillName =
    outcome.kind === "skill" && typeof outcome.skill.frontmatter.data["name"] === "string"
      ? (outcome.skill.frontmatter.data["name"] as string)
      : undefined;
  const hasError = outcome.kind === "skill" && outcome.findings.some((f) => f.severity === "error");

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col bg-neutral-950 text-neutral-100">
      <header className="flex flex-wrap items-center gap-3 border-b border-neutral-800 px-4 py-2">
        {outcome.kind === "skill" ? (
          <ScoreBadge score={outcome.score} />
        ) : (
          <span className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-sm text-amber-300">
            Not a skill
          </span>
        )}
        <ProfileSelect value={profile} onChange={setProfile} />
        <button
          type="button"
          onClick={() => setShowOpen((v) => !v)}
          className="rounded-md border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-700"
        >
          Open…
        </button>
        <div className="ml-auto">
          <ExportButtons
            files={state.files}
            dirName={state.dirName}
            skillName={skillName}
            hasError={hasError}
          />
        </div>
      </header>

      {showOpen && (
        <div className="border-b border-neutral-800 bg-neutral-900/60 p-4">
          <AnalyzeEntry
            onSkill={({ files, dirName }) => {
              dispatch({ type: "loadFiles", files, dirName });
              setShowOpen(false);
            }}
          />
        </div>
      )}

      {outcome.kind === "not-a-skill" ? (
        <NotASkillPanel reason={outcome.reason} onStartTemplate={() => dispatch({ type: "reset" })} />
      ) : (
        <div className="grid flex-1 grid-cols-1 overflow-hidden md:grid-cols-[220px_1fr_360px]">
          <aside className="hidden border-r border-neutral-800 md:block">
            <FileTree
              files={state.files}
              activePath={state.activePath}
              onSelect={(p) => dispatch({ type: "selectFile", path: p })}
              onAdd={(p) => dispatch({ type: "addFile", path: p })}
              onDelete={(p) => dispatch({ type: "deleteFile", path: p })}
            />
          </aside>
          <main className="min-h-0 border-r border-neutral-800">
            <Editor file={activeFile} onChange={(c) => dispatch({ type: "editActive", content: c })} />
          </main>
          <aside className="flex min-h-0 flex-col">
            <div className="flex border-b border-neutral-800">
              <TabButton active={tab === "findings"} onClick={() => setTab("findings")}>
                Findings
                {outcome.findings.length > 0 && (
                  <span className="ml-1 rounded-full bg-neutral-700 px-1.5 text-xs">
                    {outcome.findings.length}
                  </span>
                )}
              </TabButton>
              <TabButton active={tab === "tokens"} onClick={() => setTab("tokens")}>
                Tokens
              </TabButton>
            </div>
            <div className="min-h-0 flex-1 overflow-auto">
              {tab === "findings" ? (
                <FindingsPanel
                  findings={outcome.findings}
                  onApplyFix={(f) => dispatch({ type: "applyFix", finding: f })}
                />
              ) : (
                <TokensPanel tokens={outcome.tokens} />
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Write and run the page-level test (real engine, no mocks)**

`app/workspace/page.test.tsx`:
```tsx
// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import WorkspacePage from "./page";

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(cleanup);

describe("WorkspacePage paste flow", () => {
  it("shows an E02 finding after pasting a skill with a bad name", () => {
    render(<WorkspacePage />);
    // Open the analyze panel.
    fireEvent.click(screen.getByRole("button", { name: "Open…" }));
    const paste = screen.getByLabelText("Paste a SKILL.md");
    fireEvent.change(paste, {
      target: {
        value:
          "---\nname: Bad_Name\ndescription: Use when exercising the workspace paste flow end to end for tests\n---\n# Body",
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Analyze" }));
    // The engine flags the non-kebab name as E02 and the panel renders its chip.
    expect(screen.getByText("E02")).toBeTruthy();
  });

  it("renders the demo skill with an excellent score on first mount", () => {
    render(<WorkspacePage />);
    // Demo is valid → no error findings → export enabled.
    expect((screen.getByRole("button", { name: "Download .zip" }) as HTMLButtonElement).disabled).toBe(false);
  });
});
```

Run: `npx vitest run app/workspace/page.test.tsx`
Expected: PASS (2 tests).

> If `next build` later complains that `webkitdirectory` triggers a lint error, the `// @ts-expect-error` above suppresses the type error; no ESLint blocking rule applies in the default Next config. The build check in Task 7 confirms this.

- [ ] **Step 5: Commit**

```bash
git add components/AnalyzeEntry.tsx components/workspace/NotASkillPanel.tsx app/workspace/page.tsx app/workspace/page.test.tsx
git commit -m "feat(ui): workspace page, analyze entries, not-a-skill panel"
```

---

### Task 7: Landing page + SiteHeader nav + final verification

**Files:**
- Create: `components/SiteHeader.tsx`
- Edit: `app/layout.tsx` (mount header + dark body)
- Rewrite: `app/page.tsx` (real landing)

**Interfaces:**
- Consumes: `next/link`
- Produces: static landing at `/`, nav header in the shared layout

- [ ] **Step 1: Implement `components/SiteHeader.tsx`**

```tsx
import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="flex h-14 items-center gap-6 border-b border-neutral-800 bg-neutral-950 px-4 text-sm">
      <Link href="/" className="font-semibold text-neutral-100">
        Skillsmith
      </Link>
      <nav className="flex items-center gap-4 text-neutral-400">
        <Link href="/new" className="hover:text-neutral-100">
          Create
        </Link>
        <Link href="/workspace" className="hover:text-neutral-100">
          Workspace
        </Link>
        <Link href="/import" className="hover:text-neutral-100">
          Import
        </Link>
      </nav>
    </header>
  );
}
```

> `/new` and `/import` are built in Plans 4/5. The nav links ahead of them intentionally; static export builds cleanly because `next/link` does not validate route existence at build time. Until those routes ship, clicking them yields the static-export 404 page — acceptable pre-release.

- [ ] **Step 2: Mount the header in `app/layout.tsx`**

Replace `app/layout.tsx` with:
```tsx
import type { Metadata } from "next";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "Skillsmith",
  description: "Create, analyze and improve Claude Agent Skills",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-neutral-950 text-neutral-100 antialiased">
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Rewrite `app/page.tsx` as the landing (server component, SEO)**

```tsx
import Link from "next/link";

function FeatureCard({ title, href, body }: { title: string; href: string; body: string }) {
  return (
    <Link
      href={href}
      className="block rounded-xl border border-neutral-800 bg-neutral-900/40 p-6 transition hover:border-neutral-600"
    >
      <h2 className="text-lg font-semibold text-neutral-100">{title}</h2>
      <p className="mt-2 text-sm text-neutral-400">{body}</p>
    </Link>
  );
}

export default function Home() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <section className="text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Skillsmith</h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-neutral-400">
          Create, analyze and improve Claude Agent Skills — right in your browser.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/workspace"
            className="rounded-lg bg-sky-500 px-5 py-2.5 font-medium text-white hover:bg-sky-400"
          >
            Analyze a skill
          </Link>
          <Link
            href="/new"
            className="rounded-lg border border-neutral-700 px-5 py-2.5 font-medium text-neutral-100 hover:bg-neutral-900"
          >
            Create from template
          </Link>
        </div>
      </section>

      <section className="mt-16 grid gap-4 sm:grid-cols-3">
        <FeatureCard
          title="Analyze"
          href="/workspace"
          body="Paste, upload or drop a SKILL.md and get instant findings, a score and a token breakdown."
        />
        <FeatureCard
          title="Create"
          href="/new"
          body="A guided wizard turns your intent into a valid, well-formed skill from real-world archetypes."
        />
        <FeatureCard
          title="Import"
          href="/import"
          body="Paste any GitHub repo URL to detect its skills and load one straight into the workspace."
        />
      </section>

      <footer className="mt-20 border-t border-neutral-800 pt-6 text-center text-sm text-neutral-500">
        Static, private, no account. All analysis runs in your browser.
      </footer>
    </main>
  );
}
```

- [ ] **Step 4: Run the full test suite**

Run: `npm test`
Expected: PASS — every file green: engine tests (Plans 1/2), `lib/zip`, `lib/handoff`, `useWorkspace`, `FindingsPanel`, `TokensPanel`, `ExportButtons`, `FileTree`, `app/workspace/page`.

- [ ] **Step 5: Verify the static export build**

Run: `npm run build`
Expected: build succeeds with no server-code errors.
Run: `ls out/workspace*`
Expected: either `out/workspace/index.html` or `out/workspace.html` exists (Next static export may emit either — both satisfy the check). Also confirm `out/index.html` (landing) still exists.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(ui): landing page and shared nav header"
```

---

## Self-Review (run after writing, before handoff)

1. **Spec coverage (Plan 3 scope):** §3 flow — three entry doors converge on the workspace (AnalyzeEntry paste/upload/zip/drop in Task 6; hand-off receiver in Tasks 2–3; export .zip/.skill/copy in Task 5); localStorage draft persistence (Task 3). §7 tokens — four progressive-disclosure rows with bars, educational one-liners, "~estimated" disclaimer, total (Task 4). §11 errors — not-a-skill friendly panel + "start from template" (Task 6), 2 MB file cap (Task 6), localStorage/sessionStorage quota caught non-fatally (Tasks 2, 3). Wizard (§8) and importer (§9) are Plans 4/5 — only their hand-off contract (`stashIncomingSkill`) is built here.
2. **Engine API fidelity:** verified against `lib/skill-lint/index.ts` — `lintSkill(files, { profile, dirName })`, `LintOutcome` discriminated on `kind`, `Finding.fix.apply(files) => files`, `TokenReport { metadata, body, references, scriptFiles, total }`, `ScoreResult { value, band }` with bands `excellent|good|needs-work|poor` (matches `score.ts`). No non-existent engine functions or fields are referenced. The engine is imported, never modified.
3. **Static-export safety:** no server actions, no API routes, no route handlers, no `headers()`/`cookies()`, no dynamic segments. Browser APIs (`document`, `navigator`, `URL`, `localStorage`, `sessionStorage`) appear only inside `"use client"` event handlers / `useEffect`; `lib/zip.ts` and `lib/handoff.ts` reference them only inside function bodies (safe to import in node tests). Draft/hand-off restore runs in `useEffect` after mount, so SSR/first-client render is the deterministic demo — no hydration mismatch.
4. **Placeholder scan:** none — every component and test carries complete code; no TODOs, no stubbed returns.
5. **Type consistency across tasks:** `AnalyzeResult` (Task 6) ⇄ `useWorkspace` `loadFiles` (Task 3); `Finding.fix` (Task 4 FindingsPanel button, Task 3 `applyFix`) matches `AutoFix`; `zipSkill`/`downloadBlob`/`unzipSkill` (Task 1) consumed by ExportButtons (Task 5) and AnalyzeEntry (Task 6); `takeIncomingSkill` (Task 2) consumed by `useWorkspace` (Task 3).
6. **Resolved ambiguities:** (a) `useWorkspace` gains `addFile`/`deleteFile` actions beyond the spec's named five, required by the file tree; `deleteFile` protects `SKILL.md`. (b) The "empty state" analyze entry is realized as an always-available "Open…" toggle on the workspace header (the workspace is never truly empty because the demo starter loads), plus the same `AnalyzeEntry` component reused on the landing via the wizard/importer flows in later plans. (c) `.skill` export reuses the exact `zipSkill` bytes, only the filename differs (official format).
