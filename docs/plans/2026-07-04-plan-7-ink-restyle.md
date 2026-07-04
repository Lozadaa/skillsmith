# Skillsmith Plan 7: "Inked Workshop Manual" Visual Restyle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. This is a **styling-only** plan — read the Global Constraints before touching any file.

**Goal:** Re-skin the entire Skillsmith UI as a page from a smith's inked workbook — near-white paper, black pen linework, one scarce ember accent — without changing a single component's DOM, props, or behavior (two narrow exceptions only). The result must build as a static export and keep all 286+ existing tests green **unmodified**.

**Architecture:** The restyle is delivered in three layers, exactly as the design spec (`docs/design/ink-style.md`) prescribes:
1. **Foundation** — `next/font/google` self-hosts three faces (IM Fell English / Alegreya Sans / IBM Plex Mono) as CSS variables on `<html>`; `app/globals.css` grows a Tailwind 4 `@theme` block (CSS-first, no `tailwind.config.js`) mapping the ink tokens to utilities, plus a reusable linework component-class system (`.ink-panel`, `.ink-btn`, `.ink-stamp`, `.ink-divider`, `.ink-card`, `.ink-underline`).
2. **Surface swap** — every component's `className` strings are rewritten verbatim-from-current: neutral-dark Tailwind classes (`bg-neutral-950`, `text-neutral-100`, `border-neutral-800`, `bg-sky-500`, …) become ink classes (`bg-paper`, `text-ink`, `border-ink`, `.ink-btn`, …). JSX structure, props, hooks, handlers, `data-testid`s, `aria-*` and asserted classes are untouched.
3. **Two visual exceptions** — the landing hero content (blacksmith illustration + workshop copy) and the internal markup of `ScoreBadge` (turned into the proof-mark stamp). Nothing else changes its DOM.

**Tech Stack:** Next.js 15 (static export, `output: 'export'`) + React 19 + Tailwind 4 (`@import "tailwindcss"`, CSS-first `@theme`) + `next/font/google` (self-hosted at build, zero runtime requests). TypeScript strict. Vitest 3 + Testing Library (jsdom per-file). Node 22. npm. Run everything from repo root `C:\Users\richa\projects\skillsmith`.

**Roadmap context:** Plans 1–6 built the engine, rule catalog, workspace UI, wizard, and GitHub import/write. Plan 7 is a pure presentation pass over that finished surface — no engine, no data flow, no new routes.

## Global Constraints

- **STYLING-ONLY.** No component API/DOM/behavior changes outside the two named exceptions (landing hero content, `ScoreBadge` visual markup). Changes are limited to `className`/Tailwind values, global CSS tokens, and fonts. Same files, same props, same JSX structure, same hooks and handlers.
- **All existing tests must pass UNMODIFIED.** Exactly one test asserts a class: `components/workspace/FileTree.test.tsx:42` asserts the delete button's `className` contains `focus:opacity-100`. That class is **preserved verbatim** in the restyle. No other test inspects `className` (verified by grep across `**/*.test.tsx`). All other tests assert roles, `data-testid`s, label text, `disabled` state, and callback calls — none of which this plan touches. If a future test asserts a purely cosmetic class you must remove, document it; this plan removes none.
- **New components:** none are introduced. (Per the user mandate, had any been needed they would be derived from the closest existing sibling. All work here edits existing files.)
- **Spacing/margins discipline:** keep a consistent 4px rhythm and generous paper gutters. Where a className swap is a judgment call on spacing, prefer the existing spacing value — this is a skin, not a re-layout.
- **The ember accent is SCARCE.** `--ember` appears only on interactive states (button hover/active, focus outline, link hover, dragging drop-zone) and the score/hot signal. Every page must read B&W first; if a swap would spend ember on a static surface, use ink instead.
- **Fonts self-hosted via `next/font`** — no external requests at runtime. Static export (`npm run build` → `out/`) must stay green.
- **Every className edit is shown below as the complete rewritten file** (or complete component JSX for the two exceptions). No "adjust classes" prose — copy the full file.
- 100% static: never add server code, API routes, or `next/image` optimization that would need a loader. The hero uses a plain `<img>` from `/blacksmith.png` (no `next.config.ts` change, no image domain config).

---

### Task 1: Foundation — fonts, tokens, and the linework CSS system

**Files:**
- Edit: `app/layout.tsx` (wire the three `next/font/google` faces as CSS variables on `<html>`; swap body classes to paper/ink)
- Rewrite: `app/globals.css` (Tailwind 4 `@theme` ink tokens + base styles + reusable linework component classes)

**Interfaces:**
- Consumes: nothing new (uses `next/font/google`, already available with `next@15`)
- Produces (used by every later task):
  - Color utilities: `bg-paper` `text-ink` `text-ink-soft` `border-ink` `text-ember` `bg-ember` `text-severity-error` `text-severity-warning` (+ `border-*`, `bg-*` variants) and opacity forms like `bg-ink/10`.
  - Font utilities: `font-display` (IM Fell English), `font-body` (Alegreya Sans, also the default sans), `font-mono` (IBM Plex Mono).
  - Component classes: `.ink-panel` / `.ink-panel-b` / `.ink-panel-c` (wobbly borders, three radius sets A/B/C), `.ink-btn` (letterpress), `.ink-card` (hover rotate + shadow grow), `.ink-stamp` (double-ring proof mark), `.ink-divider`, `.ink-underline` (hand-stroke hover), plus a global focus-visible rule and a `prefers-reduced-motion` guard.

- [ ] **Step 1: Wire the fonts and paper body in `app/layout.tsx`**

Complete file after edit:

```tsx
import type { Metadata } from "next";
import { IM_Fell_English, Alegreya_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";

// Self-hosted at build by next/font — no runtime request to Google.
const display = IM_Fell_English({
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
  variable: "--font-im-fell",
  display: "swap",
});

const body = Alegreya_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-alegreya-sans",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Skillsmith",
  description: "Create, analyze and improve Claude Agent Skills",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body className="min-h-screen bg-paper text-ink antialiased">
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
```

Notes: the three `.variable` strings emit `--font-im-fell` / `--font-alegreya-sans` / `--font-plex-mono` on `<html>`; the `@theme` block in Step 2 references them. Body classes moved from `bg-neutral-950 text-neutral-100` to `bg-paper text-ink`.

- [ ] **Step 2: Rewrite `app/globals.css`**

Complete file (replaces the single `@import "tailwindcss";` line):

```css
@import "tailwindcss";

/* ---------------------------------------------------------------------------
   Ink workshop tokens — Tailwind 4 CSS-first theme (no tailwind.config.js).
   Color tokens named --color-* generate bg-/text-/border- utilities.
   Font tokens named --font-* generate font- utilities and reference the
   CSS variables that next/font sets on <html> (see app/layout.tsx).
--------------------------------------------------------------------------- */
@theme {
  --color-paper: #fdfcf9;
  --color-ink: #16130e;
  --color-ink-soft: #5c564b;
  --color-ember: #e8590c;
  --color-ember-deep: #b93e05;
  --color-severity-error: #c92a2a;
  --color-severity-warning: #b7791f;

  --font-display: var(--font-im-fell), "Iowan Old Style", Georgia, serif;
  --font-body: var(--font-alegreya-sans), ui-sans-serif, system-ui, sans-serif;
  --font-mono: var(--font-plex-mono), ui-monospace, "SFMono-Regular", Menlo, monospace;

  /* Make the humanist body face the default sans for the whole app. */
  --font-sans: var(--font-alegreya-sans), ui-sans-serif, system-ui, sans-serif;
}

@layer base {
  html {
    font-family: var(--font-body);
  }
  body {
    background-color: var(--color-paper);
    color: var(--color-ink);
  }
  ::selection {
    background-color: var(--color-ember);
    color: var(--color-paper);
  }
  /* Accessibility floor: ember focus ring, offset 2px. */
  :focus-visible {
    outline: 2px solid var(--color-ember);
    outline-offset: 2px;
  }
}

/* ---------------------------------------------------------------------------
   Linework system — reusable component classes applied via className.
   Three wobbly-border radius sets (A/B/C) so panels never look cloned.
--------------------------------------------------------------------------- */
@layer components {
  /* Radius set A */
  .ink-panel {
    border: 2px solid var(--color-ink);
    background-color: var(--color-paper);
    border-radius: 255px 15px 225px 15px / 15px 225px 15px 255px;
  }
  /* Radius set B */
  .ink-panel-b {
    border: 2px solid var(--color-ink);
    background-color: var(--color-paper);
    border-radius: 15px 225px 15px 255px / 255px 15px 225px 15px;
  }
  /* Radius set C */
  .ink-panel-c {
    border: 2px solid var(--color-ink);
    background-color: var(--color-paper);
    border-radius: 225px 15px 255px 12px / 12px 255px 15px 225px;
  }

  /* Letterpress button: paper fill, wobbly ink border, hard offset shadow.
     Hover heats to ember; active presses in; disabled reads as pencil. */
  .ink-btn {
    border: 2px solid var(--color-ink);
    background-color: var(--color-paper);
    color: var(--color-ink);
    border-radius: 255px 12px 225px 12px / 12px 225px 12px 255px;
    box-shadow: 3px 3px 0 0 var(--color-ink);
    transition:
      background-color 120ms ease,
      color 120ms ease,
      box-shadow 120ms ease,
      transform 120ms ease;
  }
  .ink-btn:hover:not(:disabled):not([aria-disabled="true"]) {
    background-color: var(--color-ember);
    color: var(--color-paper);
  }
  .ink-btn:active:not(:disabled):not([aria-disabled="true"]) {
    transform: translate(1px, 1px);
    box-shadow: 2px 2px 0 0 var(--color-ink);
    background-color: var(--color-ember-deep);
    color: var(--color-paper);
  }
  .ink-btn:disabled,
  .ink-btn[aria-disabled="true"] {
    border-color: var(--color-ink-soft);
    color: var(--color-ink-soft);
    background-color: var(--color-paper);
    box-shadow: none;
    cursor: not-allowed;
  }

  /* Sketched card: panel + the only hover motion beyond button presses. */
  .ink-card {
    box-shadow: 3px 3px 0 0 var(--color-ink);
    transition:
      transform 150ms ease,
      box-shadow 150ms ease;
  }
  .ink-card:hover {
    transform: rotate(-0.4deg);
    box-shadow: 5px 5px 0 0 var(--color-ink);
  }

  /* Proof-mark stamp: double ink ring around the score. Color set by
     the caller via `currentColor` (band-driven text color). */
  .ink-stamp {
    border: 2px solid currentColor;
    box-shadow:
      0 0 0 2px var(--color-paper),
      0 0 0 4px currentColor;
    border-radius: 255px 20px 225px 20px / 20px 225px 20px 255px;
  }

  /* Pen-stroke divider: 2px ink rule with a slight rotation. */
  .ink-divider {
    border: none;
    border-top: 2px solid var(--color-ink);
    transform: rotate(-0.3deg);
  }

  /* Hand-stroke underline that draws in on hover, slightly rotated. */
  .ink-underline {
    position: relative;
  }
  .ink-underline::after {
    content: "";
    position: absolute;
    left: 0;
    right: 0;
    bottom: -3px;
    height: 2px;
    background-color: var(--color-ink);
    transform: rotate(-0.4deg) scaleX(0);
    transform-origin: left center;
    transition: transform 150ms ease;
  }
  .ink-underline:hover::after {
    transform: rotate(-0.4deg) scaleX(1);
  }
}

/* Motion restraint: honor reduced-motion for every animated affordance. */
@media (prefers-reduced-motion: reduce) {
  .ink-btn,
  .ink-card,
  .ink-underline::after {
    transition: none !important;
  }
  .ink-card:hover {
    transform: none !important;
  }
  .ink-underline:hover::after {
    transform: rotate(-0.4deg) scaleX(1) !important;
  }
}
```

- [ ] **Step 3: Verify the foundation builds and the suite stays green**

There is no meaningful jsdom unit test for global CSS classes (Vitest does not run PostCSS/Tailwind, so `bg-paper` never resolves in tests — asserting it would test nothing). Verification is therefore the build + full suite:

Run: `npm run build`
Expected: build succeeds; `out/index.html` exists. The `next/font` fetch happens at build time only (self-hosted); no runtime font request.

Run: `npm test`
Expected: all existing tests pass (styling-only foundation — no behavior touched).

- [ ] **Step 4: Commit**

```bash
git add app/layout.tsx app/globals.css
git commit -m "feat(ink): fonts, @theme tokens, and linework CSS system"
```

---

### Task 2: Landing page + SiteHeader (the one content exception)

**Files:**
- Rewrite: `app/page.tsx` (hero content exception + feature cards as ink panels with inline-SVG ink icons)
- Rewrite: `components/SiteHeader.tsx` (display-face wordmark + hand-stroke underline nav)

**Interfaces:**
- Consumes: Task 1 utilities/classes, `/blacksmith.png`
- Produces: nothing consumed downstream — these are leaf views. Routes and `href`s (`/`, `/workspace`, `/new`, `/import`) are unchanged.

- [ ] **Step 1: Rewrite `components/SiteHeader.tsx`**

Same DOM shape (header → wordmark Link + nav of three Links, same hrefs/text). Only classes change: paper strip, 2px ink bottom border, display-face wordmark, ember hand-stroke underline on hover.

```tsx
import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="flex h-14 items-center gap-6 border-b-2 border-ink bg-paper px-4 text-sm">
      <Link href="/" className="ink-underline font-display text-xl text-ink hover:text-ember">
        Skillsmith
      </Link>
      <nav className="flex items-center gap-5 text-ink-soft">
        <Link href="/new" className="ink-underline hover:text-ember">
          Create
        </Link>
        <Link href="/workspace" className="ink-underline hover:text-ember">
          Workspace
        </Link>
        <Link href="/import" className="ink-underline hover:text-ember">
          Import
        </Link>
      </nav>
    </header>
  );
}
```

- [ ] **Step 2: Rewrite `app/page.tsx`** (hero content exception + ink feature cards)

The hero content (headline, subline, illustration, CTA copy) is the user-approved exception. The `FeatureCard` shape stays a `Link` wrapper (same prop names), now an ink card with a tiny inline-SVG ink icon; copy uses the workshop voice. All hrefs unchanged.

```tsx
import Link from "next/link";

type IconName = "anvil" | "hammer" | "crate";

function InkIcon({ name }: { name: IconName }) {
  const common = {
    width: 28,
    height: 28,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  if (name === "anvil") {
    return (
      <svg {...common}>
        <path d="M3 8h13a4 4 0 0 1-4 4H9l-1 3" />
        <path d="M16 8l4-1v3l-3 1" />
        <path d="M6 18h8" />
        <path d="M8 15h4l1 3H7z" />
      </svg>
    );
  }
  if (name === "hammer") {
    return (
      <svg {...common}>
        <path d="M14 4l6 6-3 3-6-6z" />
        <path d="M11 7L4 14a2 2 0 0 0 0 3l0 0a2 2 0 0 0 3 0l7-7" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M4 8l8-4 8 4v8l-8 4-8-4z" />
      <path d="M4 8l8 4 8-4" />
      <path d="M12 12v8" />
    </svg>
  );
}

function FeatureCard({
  title,
  href,
  body,
  icon,
}: {
  title: string;
  href: string;
  body: string;
  icon: IconName;
}) {
  return (
    <Link href={href} className="ink-panel ink-card block p-6 text-ink">
      <div className="flex items-center gap-3">
        <InkIcon name={icon} />
        <h2 className="font-display text-xl text-ink">{title}</h2>
      </div>
      <p className="mt-3 text-sm text-ink-soft">{body}</p>
    </Link>
  );
}

export default function Home() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <section className="grid items-center gap-10 md:grid-cols-[1fr_45%]">
        <div>
          <h1 className="font-display text-5xl leading-tight text-ink sm:text-6xl">
            Forge better skills.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-ink-soft">
            Skillsmith is the smith&apos;s bench for Claude Agent Skills — inspect, temper and ship a
            spec-clean SKILL.md, entirely in your browser.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link href="/workspace" className="ink-btn px-5 py-2.5 font-medium">
              Open the workshop
            </Link>
            <Link href="/new" className="ink-btn px-5 py-2.5 font-medium">
              Start forging
            </Link>
          </div>
        </div>
        <img
          src="/blacksmith.png"
          alt="A blacksmith hammering hot metal on an anvil — hand-drawn in ink."
          className="w-full max-w-md justify-self-center md:justify-self-end"
        />
      </section>

      <hr className="ink-divider my-14" />

      <section className="grid gap-5 sm:grid-cols-3">
        <FeatureCard
          title="Inspect"
          href="/workspace"
          icon="anvil"
          body="Paste, upload or drop a SKILL.md and get instant findings, a proof-mark score and a token breakdown."
        />
        <FeatureCard
          title="Forge"
          href="/new"
          icon="hammer"
          body="A guided wizard turns your intent into a valid, well-formed skill from real-world archetypes."
        />
        <FeatureCard
          title="Import"
          href="/import"
          icon="crate"
          body="Paste any GitHub repo URL to detect its skills and load one straight onto the bench."
        />
      </section>

      <footer className="mt-20 border-t-2 border-ink pt-6 text-center text-sm text-ink-soft">
        Static, private, no account. All analysis runs in your browser.
      </footer>
    </main>
  );
}
```

- [ ] **Step 3: Verify**

Run: `npm run build` — expected: succeeds; `/blacksmith.png` is copied into `out/` (it already lives in `public/`).
Run: `npm test` — expected: all green (no test renders the landing page or SiteHeader against classes).

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx components/SiteHeader.tsx
git commit -m "feat(ink): forged landing hero + inked SiteHeader"
```

---

### Task 3: Workspace surfaces (incl. ScoreBadge visual exception)

**Files:**
- Rewrite (visual exception): `components/workspace/ScoreBadge.tsx` (proof-mark stamp)
- Rewrite (className-only): `app/workspace/page.tsx`, `components/AnalyzeEntry.tsx`, `components/workspace/ExportButtons.tsx`, `components/workspace/FileTree.tsx`, `components/workspace/Editor.tsx`, `components/workspace/FindingsPanel.tsx`, `components/workspace/TokensPanel.tsx`, `components/workspace/ProfileSelect.tsx`, `components/workspace/NotASkillPanel.tsx`

**Interfaces:**
- Consumes: Task 1 classes. Every prop, hook, handler, `data-testid`, `aria-*`, role and button text is preserved.
- Test guards: `FileTree.test.tsx` asserts the delete button keeps `focus:opacity-100`; `ExportButtons.test.tsx`, `app/workspace/page.test.tsx` assert `disabled` state and visible text (`Download .zip`, `Copy SKILL.md`, `Open…`, `Analyze`, `Paste a SKILL.md`, `E02`). All preserved below.

- [ ] **Step 1: Rewrite `components/workspace/ScoreBadge.tsx`** (visual markup exception)

Derived from the current `ScoreBadge` structure: keep the `BAND` record + `title` attribute, but the two-span badge becomes the circular double-ring proof stamp — rotated −6°, ink for excellent/good, warning-ink for needs-work, error-ink for poor, score number in the display face. Same prop (`score: ScoreResult`), same single default export usage.

```tsx
import type { ScoreResult } from "@/lib/skill-lint";

// Band drives the stamp's ink color via currentColor (used by .ink-stamp rings).
const BAND: Record<ScoreResult["band"], { label: string; ink: string }> = {
  excellent: { label: "Excellent", ink: "text-ink" },
  good: { label: "Good", ink: "text-ink" },
  "needs-work": { label: "Needs work", ink: "text-severity-warning" },
  poor: { label: "Poor", ink: "text-severity-error" },
};

export function ScoreBadge({ score }: { score: ScoreResult }) {
  const band = BAND[score.band];
  return (
    <div
      className={`ink-stamp flex h-16 w-16 shrink-0 -rotate-6 flex-col items-center justify-center ${band.ink}`}
      title={`Score ${score.value}/100 — ${band.label}`}
    >
      <span className="font-display text-2xl leading-none tabular-nums">{score.value}</span>
      <span className="mt-0.5 text-[8px] font-semibold uppercase tracking-[0.15em]">{band.label}</span>
    </div>
  );
}
```

- [ ] **Step 2: Rewrite `app/workspace/page.tsx`** (className-only; TabButton, header, "Not a skill" chip, panel borders)

Structure, state, dispatch, and the `ScoreBadge` / `ExportButtons` / `AnalyzeEntry` wiring are identical. Only classes change (neutral → ink; sky tab underline → ember; amber chip → ink panel + warning ink).

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
        active ? "border-b-2 border-ember text-ink" : "text-ink-soft hover:text-ink"
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
  const hasError = outcome.kind !== "skill" || outcome.findings.some((f) => f.severity === "error");

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col bg-paper text-ink">
      <header className="flex flex-wrap items-center gap-3 border-b-2 border-ink px-4 py-2">
        {outcome.kind === "skill" ? (
          <ScoreBadge score={outcome.score} />
        ) : (
          <span className="ink-panel px-3 py-1.5 text-sm font-medium text-severity-warning">
            Not a skill
          </span>
        )}
        <ProfileSelect value={profile} onChange={setProfile} />
        <button
          type="button"
          onClick={() => setShowOpen((v) => !v)}
          className="ink-btn px-3 py-1.5 text-sm"
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
        <div className="border-b-2 border-ink bg-paper p-4">
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
          <aside className="hidden border-r-2 border-ink md:block">
            <FileTree
              files={state.files}
              activePath={state.activePath}
              onSelect={(p) => dispatch({ type: "selectFile", path: p })}
              onAdd={(p) => dispatch({ type: "addFile", path: p })}
              onDelete={(p) => dispatch({ type: "deleteFile", path: p })}
            />
          </aside>
          <main className="min-h-0 border-r-2 border-ink">
            <Editor file={activeFile} onChange={(c) => dispatch({ type: "editActive", content: c })} />
          </main>
          <aside className="flex min-h-0 flex-col">
            <div className="flex border-b-2 border-ink">
              <TabButton active={tab === "findings"} onClick={() => setTab("findings")}>
                Findings
                {outcome.findings.length > 0 && (
                  <span className="ml-1 rounded-full border border-ink px-1.5 text-xs">
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

- [ ] **Step 3: Rewrite `components/AnalyzeEntry.tsx`** (className-only)

Only the `return (...)` JSX classes change. All logic (`commonRoot`, `rootFromArchiveName`, `readPlainFiles`, `handleFiles`, refs, state, `webkitdirectory` `@ts-expect-error`) and every `id`/`htmlFor`/`aria-label`/label text (`Paste a SKILL.md`, `Analyze`, `Choose files / archive`, `Choose folder`) are preserved verbatim. Below is the full file; the logic block above `return` is unchanged from the current file.

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
        <label htmlFor="analyze-paste" className="mb-1 text-sm font-medium text-ink">
          Paste a SKILL.md
        </label>
        <textarea
          id="analyze-paste"
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
          placeholder={"---\nname: my-skill\ndescription: Use when …\n---\n# Body"}
          className="ink-panel h-40 w-full resize-none p-3 font-mono text-xs text-ink outline-none placeholder:text-ink-soft/60"
        />
        <button
          type="button"
          onClick={submitPaste}
          disabled={!paste.trim()}
          className="ink-btn mt-2 self-start px-3 py-1.5 text-sm font-medium"
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
        className={`flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-6 text-center ${
          dragging ? "border-ember bg-ember/5" : "border-ink-soft"
        }`}
      >
        <p className="text-sm text-ink-soft">Drop a folder or a .zip / .skill here, or</p>
        <div className="flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="ink-btn px-3 py-1.5 text-sm"
          >
            Choose files / archive
          </button>
          <button
            type="button"
            onClick={() => dirInputRef.current?.click()}
            className="ink-btn px-3 py-1.5 text-sm"
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
        {error && <p className="text-xs text-severity-warning">{error}</p>}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Rewrite `components/workspace/ExportButtons.tsx`** (className-only)

Logic (`btnCls` now returns ink-btn classes), handlers, `disabled`/`title` gate and button text (`Download .zip`, `Download .skill`, `Copy SKILL.md`) unchanged — the `ExportButtons.test.tsx` asserts only `disabled` and names.

```tsx
"use client";

import { useState } from "react";
import type { SkillFile } from "@/lib/skill-lint";
import { downloadBlob, zipSkill } from "@/lib/zip";

function btnCls(): string {
  return "ink-btn px-3 py-1.5 text-sm font-medium";
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
      <button type="button" onClick={onZip} disabled={hasError} title={gateTitle} className={btnCls()}>
        Download .zip
      </button>
      <button type="button" onClick={onSkill} disabled={hasError} title={gateTitle} className={btnCls()}>
        Download .skill
      </button>
      <button type="button" onClick={onCopy} className={btnCls()}>
        {copied ? "Copied!" : "Copy SKILL.md"}
      </button>
    </div>
  );
}
```

Note: `hasError` disables `.zip`/`.skill` via the native `disabled` attribute; `.ink-btn:disabled` renders the pencil state. The `.skill`/`.zip` buttons no longer need a per-state class function, so `btnCls` takes no argument — a purely internal helper, not a prop or asserted API.

- [ ] **Step 5: Rewrite `components/workspace/FileTree.tsx`** (className-only — KEEP `focus:opacity-100`)

The delete button keeps `opacity-0 group-hover:opacity-100 focus:opacity-100` exactly (FileTree.test.tsx line 42). Only colors change; the delete-hover swaps `hover:text-red-400` → `hover:text-severity-error`. All `aria-label`s and the `New file path` input unchanged.

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
                    ? "bg-ink text-paper"
                    : "text-ink-soft hover:bg-ink/5"
                }`}
              >
                {f.path}
              </button>
              {f.path !== "SKILL.md" && (
                <button
                  type="button"
                  aria-label={`Delete ${f.path}`}
                  onClick={() => onDelete(f.path)}
                  className="ml-1 px-1 text-ink-soft opacity-0 hover:text-severity-error focus:opacity-100 group-hover:opacity-100"
                >
                  ×
                </button>
              )}
            </li>
          ))}
      </ul>
      <form onSubmit={submit} className="border-t-2 border-ink p-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="add file e.g. references/api.md"
          aria-label="New file path"
          className="w-full rounded border-2 border-ink bg-paper px-2 py-1 font-mono text-xs text-ink placeholder:text-ink-soft/60"
        />
      </form>
    </div>
  );
}
```

- [ ] **Step 6: Rewrite `components/workspace/Editor.tsx`** (className-only)

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
      <div className="flex h-full items-center justify-center text-sm text-ink-soft">
        No file selected.
      </div>
    );
  }
  return (
    <div className="flex h-full flex-col">
      <div className="border-b-2 border-ink px-3 py-1.5 font-mono text-xs text-ink-soft">
        {file.path}
      </div>
      <textarea
        value={file.content}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        aria-label={`Editor for ${file.path}`}
        className="w-full flex-1 resize-none bg-paper p-4 font-mono text-sm leading-relaxed text-ink outline-none"
      />
    </div>
  );
}
```

- [ ] **Step 7: Rewrite `components/workspace/FindingsPanel.tsx`** (className-only)

Severity ink: error → severity-error, warning → severity-warning, suggestion → ink-soft. Rule IDs and paths stay mono. The `Apply fix` button becomes a small ink button. Structure, `details`/`summary`, and all text preserved.

```tsx
"use client";

import type { Finding, Severity } from "@/lib/skill-lint";

const SEVERITY_META: Record<Severity, { label: string; dot: string; badge: string }> = {
  error: { label: "Errors", dot: "bg-severity-error", badge: "border-severity-error text-severity-error" },
  warning: { label: "Warnings", dot: "bg-severity-warning", badge: "border-severity-warning text-severity-warning" },
  suggestion: { label: "Suggestions", dot: "bg-ink-soft", badge: "border-ink-soft text-ink-soft" },
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
      <div className="p-6 text-sm text-ink-soft">
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
            <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">
              <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
              {meta.label}
              <span className={`rounded-full border px-1.5 py-0.5 text-[10px] ${meta.badge}`}>{group.length}</span>
            </h3>
            <ul className="flex flex-col gap-2">
              {group.map((f, i) => (
                <li
                  key={`${f.ruleId}-${i}`}
                  className="ink-panel p-3"
                >
                  <div className="flex items-center gap-2">
                    <span className="rounded border border-ink px-1.5 py-0.5 font-mono text-[11px] text-ink">
                      {f.ruleId}
                    </span>
                    {typeof f.line === "number" && (
                      <span className="font-mono text-[11px] text-ink-soft">L{f.line}</span>
                    )}
                    {f.file && f.file !== "SKILL.md" && (
                      <span className="font-mono text-[11px] text-ink-soft">{f.file}</span>
                    )}
                    {f.fix && (
                      <button
                        type="button"
                        onClick={() => onApplyFix(f)}
                        className="ink-btn ml-auto px-2 py-1 text-xs font-medium"
                      >
                        {f.fix.label || "Apply fix"}
                      </button>
                    )}
                  </div>
                  <p className="mt-2 text-sm text-ink">{f.message}</p>
                  <details className="mt-1 text-sm text-ink-soft">
                    <summary className="cursor-pointer select-none text-xs text-ink-soft hover:text-ink">
                      Why it matters &amp; how to fix
                    </summary>
                    <p className="mt-2">
                      <span className="font-medium text-ink">Why: </span>
                      {f.why}
                    </p>
                    <p className="mt-1">
                      <span className="font-medium text-ink">Fix: </span>
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

- [ ] **Step 8: Rewrite `components/workspace/TokensPanel.tsx`** (className-only)

The bars stay B&W (ink fill on a faint ink track) — the ember accent is reserved; token meters are quantitative, not "hot". Row logic, `data`, notes, and totals unchanged.

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
      <p className="text-xs text-ink-soft">
        ~estimated — Anthropic does not publish the Claude 3+ tokenizer, so these are heuristic counts.
      </p>
      <ul className="flex flex-col gap-4">
        {rows.map((r) => {
          const pct = r.unit === "tokens" ? Math.round((r.value / maxTokens) * 100) : 0;
          return (
            <li key={r.key}>
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-ink">{r.label}</span>
                <span className="font-mono text-ink-soft">
                  {r.value} {r.unit === "tokens" ? "tok" : r.value === 1 ? "file" : "files"}
                </span>
              </div>
              {r.unit === "tokens" && (
                <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-ink/10">
                  <div className="h-full rounded-full bg-ink" style={{ width: `${pct}%` }} />
                </div>
              )}
              <p className="mt-1 text-xs text-ink-soft">{r.note}</p>
            </li>
          );
        })}
      </ul>
      <div className="flex items-baseline justify-between border-t-2 border-ink pt-3 text-sm">
        <span className="font-medium text-ink">Total context (metadata + body + references)</span>
        <span className="font-mono text-ink">{tokens.total} tok</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 9: Rewrite `components/workspace/ProfileSelect.tsx`** (className-only)

```tsx
"use client";

import type { Profile } from "@/lib/skill-lint";

export function ProfileSelect({ value, onChange }: { value: Profile; onChange: (p: Profile) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm text-ink-soft">
      <span className="hidden sm:inline">Profile</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as Profile)}
        aria-label="Lint profile"
        className="rounded-md border-2 border-ink bg-paper px-2 py-1 text-sm text-ink"
      >
        <option value="generic">Generic (agentskills.io)</option>
        <option value="claude-code-plugin">Claude Code plugin</option>
      </select>
    </label>
  );
}
```

- [ ] **Step 10: Rewrite `components/workspace/NotASkillPanel.tsx`** (className-only)

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
      <div className="ink-panel max-w-md p-6">
        <h2 className="font-display text-xl text-severity-warning">This doesn&apos;t look like a skill</h2>
        <p className="mt-2 text-sm text-ink">{reason}</p>
        <button
          type="button"
          onClick={onStartTemplate}
          className="ink-btn mt-4 px-4 py-2 text-sm"
        >
          Start from template
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 11: Verify the workspace surfaces**

Run: `npm test`
Expected: green. Specifically `app/workspace/page.test.tsx` (E02 chip after paste, Download .zip disabled/enabled), `components/workspace/ExportButtons.test.tsx` (disabled gate), `components/workspace/FileTree.test.tsx` (incl. the `focus:opacity-100` assertion, still present), `TokensPanel.test.tsx`, `FindingsPanel.test.tsx` all pass unmodified.

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 12: Commit**

```bash
git add app/workspace/page.tsx components/AnalyzeEntry.tsx components/workspace/
git commit -m "feat(ink): re-skin workspace surfaces + proof-mark ScoreBadge"
```

---

### Task 4: Wizard + Import surfaces + final verification

**Files:**
- Rewrite (className-only): `app/new/page.tsx`, `components/wizard/StepIndicator.tsx`, `components/wizard/StepArchetype.tsx`, `components/wizard/StepIntent.tsx`, `components/wizard/NameField.tsx`, `components/wizard/StepDescription.tsx`, `components/wizard/StepContent.tsx`, `components/wizard/StepReview.tsx`
- Rewrite (className-only): `components/import/ImportApp.tsx`, `components/import/TokenField.tsx`, `components/import/ErrorPanel.tsx`, `components/import/CollectionAudit.tsx`, `components/import/SkillPicker.tsx`, `components/import/LinksList.tsx`

**Interfaces:**
- Consumes: Task 1 classes. Every `data-testid` (`name-input`, `name-error`, `desc-char-counter`, `desc-preview`, `desc-warn`, `desc-error`, `desc-person-hint`, `body-lines`, `body-warn`, `download-zip`, `mini-score-*`), every `id`/`htmlFor`, every button text (`Back`, `Next`, `Open in Workspace`, `Download .zip`, `Import`, `Scan`, `Open`, `Add a token`, …) and the `PERSON_RE`/`buildDescription`/`assembleBody` logic are preserved verbatim.
- Test guards: `StepReview.test.tsx` (testid `download-zip`, text `Open in Workspace`, `disabled`), `StepDescription.test.tsx` (`desc-preview` text), `StepContent.test.tsx`, `CollectionAudit.test.tsx`, `ImportApp.test.tsx` — all assert testids/text/behavior, never classes.

- [ ] **Step 1: Rewrite `app/new/page.tsx`** (className-only)

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
    <main className="mx-auto max-w-3xl px-4 py-8 text-ink">
      <h1 className="font-display text-3xl text-ink">Create a skill</h1>
      <p className="mt-1 text-sm text-ink-soft">
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

      <div className="mt-10 flex items-center justify-between border-t-2 border-ink pt-6">
        <button
          type="button"
          onClick={() => dispatch({ type: "back" })}
          disabled={state.step === 1}
          className="ink-btn px-4 py-2 text-sm"
        >
          Back
        </button>
        {state.step < 5 && (
          <button
            type="button"
            onClick={() => dispatch({ type: "next" })}
            disabled={!canAdvance(state)}
            className="ink-btn px-4 py-2 text-sm font-medium"
          >
            Next
          </button>
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Rewrite `components/wizard/StepIndicator.tsx`** (className-only — inked numbers)

current = ember-filled ink number; done = solid ink; todo = ink-soft outline. Connector rule in ink.

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
            ? "border-ember bg-ember text-paper"
            : state === "done"
              ? "border-ink bg-ink text-paper"
              : "border-ink-soft text-ink-soft";
        return (
          <li key={label} className="flex items-center gap-2">
            <span className={`flex h-6 w-6 items-center justify-center rounded-full border-2 font-display ${badge}`}>{n}</span>
            <span className={state === "todo" ? "text-ink-soft" : "text-ink"}>{label}</span>
            {n < STEPS.length && <span className="mx-1 hidden h-0.5 w-6 bg-ink sm:inline-block" />}
          </li>
        );
      })}
    </ol>
  );
}
```

- [ ] **Step 3: Rewrite `components/wizard/StepArchetype.tsx`** (className-only — sketch panels)

Selected card = ember accent; unselected = ink panel. `.ink-card` gives the hover lift. Structure and `dispatch` unchanged.

```tsx
"use client";

import type { Dispatch } from "react";
import { archetypes } from "@/lib/wizard/archetypes";
import type { WizardState } from "@/lib/wizard/state";
import type { WizardAction } from "./useWizard";

export function StepArchetype({ state, dispatch }: { state: WizardState; dispatch: Dispatch<WizardAction> }) {
  return (
    <div>
      <p className="mb-4 text-sm text-ink-soft">
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
                "ink-panel ink-card p-4 text-left " +
                (selected ? "outline outline-2 outline-ember" : "")
              }
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-display text-lg text-ink">{a.title}</h3>
                {a.advanced && (
                  <span className="rounded border border-severity-warning px-1.5 py-0.5 text-[10px] font-medium text-severity-warning">
                    Advanced
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-ink-soft">{a.blurb}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Rewrite `components/wizard/StepIntent.tsx`** (className-only)

`fieldClass` swaps to ink; the intent hint box becomes an ink panel. Copy and handlers unchanged.

```tsx
"use client";

import type { Dispatch } from "react";
import type { WizardState } from "@/lib/wizard/state";
import type { WizardAction } from "./useWizard";

const fieldClass =
  "mt-1 w-full rounded border-2 border-ink bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-ember";

export function StepIntent({ state, dispatch }: { state: WizardState; dispatch: Dispatch<WizardAction> }) {
  const set = (field: keyof WizardState["intent"], value: string) =>
    dispatch({ type: "setIntent", field, value });

  return (
    <div className="space-y-6">
      <div className="ink-panel p-4 text-sm text-ink">
        <p className="font-medium">One skill = one capability.</p>
        <p className="mt-1 text-ink-soft">
          Good: &ldquo;Generate release notes from a changelog.&rdquo; &nbsp;·&nbsp; Bad: &ldquo;Help with
          engineering&rdquo; (too broad — split it into focused skills).
        </p>
      </div>

      <label className="block">
        <span className="text-sm font-medium text-ink">What does this skill enable?</span>
        <textarea
          rows={2}
          className={fieldClass}
          placeholder="Generate spec-compliant release notes from a changelog."
          value={state.intent.what}
          onChange={(e) => set("what", e.target.value)}
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-ink">When should it trigger?</span>
        <textarea
          rows={2}
          className={fieldClass}
          placeholder="A changelog or list of merged PRs needs to become a readable release note."
          value={state.intent.when}
          onChange={(e) => set("when", e.target.value)}
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-ink">Expected output format</span>
        <input
          className={fieldClass}
          placeholder="Markdown document with Highlights / Fixes / Breaking sections."
          value={state.intent.output}
          onChange={(e) => set("output", e.target.value)}
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-ink">Personal or shared?</span>
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

- [ ] **Step 5: Rewrite `components/wizard/NameField.tsx`** (className-only)

Keeps `data-testid="name-input"` and `data-testid="name-error"`, the `validateName` logic, and the invalid/valid branches. Invalid border → severity-error; valid hint → ink-soft (ember reserved).

```tsx
"use client";

import { validateName } from "@/lib/wizard/name";

export function NameField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const check = validateName(value);
  const invalid = value.length > 0 && !check.ok;
  return (
    <div>
      <label className="block text-sm font-medium text-ink">Skill name (kebab-case)</label>
      <input
        data-testid="name-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="processing-pdfs"
        className={
          "mt-1 w-full rounded border-2 bg-paper px-3 py-2 text-sm text-ink outline-none " +
          (invalid ? "border-severity-error" : "border-ink focus:border-ember")
        }
      />
      {invalid && (
        <p data-testid="name-error" className="mt-1 text-xs text-severity-error">
          {check.message}
        </p>
      )}
      {value.length > 0 && check.ok && <p className="mt-1 text-xs text-ink-soft">Valid name.</p>}
    </div>
  );
}
```

- [ ] **Step 6: Rewrite `components/wizard/StepDescription.tsx`** (className-only)

All testids (`desc-char-counter`, `desc-preview`, `desc-warn`, `desc-error`, `desc-person-hint`), `PERSON_RE`, `buildDescription`, and the counter thresholds are preserved exactly. Only classes change: fields to ink, warn → severity-warning, error → severity-error, panels → ink panels, the "how the agent sees it" code block keeps a mono paper-tinted block.

```tsx
"use client";

import type { Dispatch } from "react";
import { estimateTokens } from "@/lib/skill-lint";
import { buildDescription, type WizardState } from "@/lib/wizard/state";
import type { WizardAction } from "./useWizard";
import { NameField } from "./NameField";

const fieldClass =
  "mt-1 w-full rounded border-2 border-ink bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-ember";

// Kept local (UI must not import from lib/skill-lint/rules internals), but must byte-match
// the pattern the engine uses in lib/skill-lint/rules/warnings-description.ts (W04).
const PERSON_RE = /\b(I can|I will|I'll|you can|you should|you need|use this skill when you)\b/i;

export function StepDescription({ state, dispatch }: { state: WizardState; dispatch: Dispatch<WizardAction> }) {
  const set = (field: "descWhat" | "descWhen" | "descTriggers" | "descNegative", value: string) =>
    dispatch({ type: "setText", field, value });

  const description = buildDescription(state);
  const len = description.length;
  const overHard = len > 1024;
  const overWarn = len > 500;
  const hasPerson = PERSON_RE.test(description);

  const counterClass = overHard ? "text-severity-error" : overWarn ? "text-severity-warning" : "text-ink-soft";

  return (
    <div className="space-y-6">
      <NameField value={state.name} onChange={(v) => dispatch({ type: "setText", field: "name", value: v })} />

      <label className="block">
        <span className="text-sm font-medium text-ink">What it does</span>
        <input
          className={fieldClass}
          placeholder="Generates release notes from a changelog"
          value={state.descWhat}
          onChange={(e) => set("descWhat", e.target.value)}
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-ink">When to use it</span>
        <input
          className={fieldClass}
          placeholder="a changelog or merged-PR list needs a readable release note"
          value={state.descWhen}
          onChange={(e) => set("descWhen", e.target.value)}
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-ink">Concrete trigger phrases (quoted)</span>
        <input
          className={fieldClass}
          placeholder={'"write release notes", "summarize the changelog"'}
          value={state.descTriggers}
          onChange={(e) => set("descTriggers", e.target.value)}
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-ink">Negative triggers (optional)</span>
        <input
          className={fieldClass}
          placeholder="writing marketing copy or blog posts"
          value={state.descNegative}
          onChange={(e) => set("descNegative", e.target.value)}
        />
      </label>

      <div className="ink-panel p-4">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-ink">Assembled description</span>
          <span className="flex gap-3">
            <span data-testid="desc-char-counter" className={counterClass}>
              {len}/1024 chars
            </span>
            <span className="text-ink-soft">~{estimateTokens(description)} tokens</span>
          </span>
        </div>
        <p data-testid="desc-preview" className="mt-2 text-sm text-ink">
          {description}
        </p>
        {overWarn && !overHard && (
          <p data-testid="desc-warn" className="mt-2 text-xs text-severity-warning">
            Long descriptions dilute triggering — aim for under 500 characters.
          </p>
        )}
        {overHard && (
          <p data-testid="desc-error" className="mt-2 text-xs text-severity-error">
            Over the 1024-character hard limit — the skill will be rejected. Trim it.
          </p>
        )}
        {hasPerson && (
          <p data-testid="desc-person-hint" className="mt-2 text-xs text-severity-warning">
            Prefer third-person, imperative phrasing over &ldquo;I can&rdquo; / &ldquo;you can&rdquo;.
          </p>
        )}
      </div>

      <div className="ink-panel p-4">
        <p className="text-xs font-medium text-ink-soft">How the agent sees it</p>
        <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded bg-ink/5 p-3 font-mono text-xs text-ink">
{`name: ${state.name || "your-skill-name"}
description: ${description}`}
        </pre>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Rewrite `components/wizard/StepContent.tsx`** (className-only)

`fieldClass` → ink; stats panel → ink panel; `body-warn` → severity-warning. Keeps `data-testid="body-lines"`, `data-testid="body-warn"`, the `CATEGORIES`/`LICENSES` arrays, and all handlers.

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
  "mt-1 w-full rounded border-2 border-ink bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-ember";

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
          <span className="text-sm font-medium text-ink">{s.title}</span>
          <textarea
            rows={5}
            className={`${fieldClass} font-mono`}
            placeholder={s.placeholder}
            value={state.sections[s.id] ?? ""}
            onChange={(e) => dispatch({ type: "setSection", id: s.id, value: e.target.value })}
          />
        </label>
      ))}

      <div className="ink-panel p-4 text-xs">
        <div className="flex flex-wrap gap-4 text-ink-soft">
          <span data-testid="body-lines">{lines} lines</span>
          <span>{words} words</span>
          <span>~{tokens} tokens</span>
        </div>
        {lines > 400 && (
          <p data-testid="body-warn" className="mt-2 text-severity-warning">
            The body is over 400 lines — move detail into references/ so it loads only when needed.
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium text-ink">Category</span>
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
          <span className="text-sm font-medium text-ink">License</span>
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
          <span className="text-sm font-medium text-ink">Version</span>
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
          <span className="text-sm text-ink">User-invoked only (disable-model-invocation)</span>
        </label>
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Rewrite `components/wizard/StepReview.tsx`** (className-only)

Keeps `data-testid="download-zip"`, the `Open in Workspace` / `Download .zip` buttons, `SEVERITY_COLOR`, and all `assembleSkill`/`lintSkill` logic. Score number moves to the display face; severity colors to ink tokens. The lint-score row can use a small stamp-flavored number without changing structure.

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
  error: "text-severity-error",
  warning: "text-severity-warning",
  suggestion: "text-ink-soft",
};

export function StepReview({ state }: { state: WizardState }) {
  const router = useRouter();
  const { files, dirName } = useMemo(() => assembleSkill(state), [state]);
  const outcome = useMemo(() => lintSkill(files, { dirName }), [files, dirName]);

  const findings = outcome.kind === "skill" ? outcome.findings : [];
  const errors = findings.filter((f) => f.severity === "error");
  const score = outcome.kind === "skill" ? outcome.score : null;
  const exportBlocked = outcome.kind !== "skill" || errors.length > 0;

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
      <div className="ink-panel flex items-center justify-between p-4">
        <div>
          <p className="text-sm text-ink-soft">Lint score</p>
          <p className="font-display text-3xl text-ink">
            {score ? `${score.value}/100` : "—"}
            {score && <span className="ml-2 text-sm font-normal text-ink-soft">{score.band}</span>}
          </p>
        </div>
        <div className="text-right text-xs text-ink-soft">
          <p>{files.length} file(s)</p>
          <p>{dirName || "unnamed"}/</p>
        </div>
      </div>

      <div className="ink-panel p-4">
        <p className="mb-2 text-sm font-medium text-ink">Findings</p>
        {findings.length === 0 ? (
          <p className="text-sm text-ink-soft">No findings — the skill is clean.</p>
        ) : (
          <ul className="space-y-2 text-xs">
            {findings.map((f, i) => (
              <li key={`${f.ruleId}-${i}`} className="flex gap-2">
                <span className={`font-mono ${SEVERITY_COLOR[f.severity]}`}>{f.ruleId}</span>
                <span className="text-ink">{f.message}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={openInWorkspace}
          className="ink-btn px-4 py-2 text-sm font-medium"
        >
          Open in Workspace
        </button>
        <button
          type="button"
          onClick={download}
          disabled={exportBlocked}
          data-testid="download-zip"
          className="ink-btn px-4 py-2 text-sm font-medium"
        >
          Download .zip
        </button>
        {errors.length > 0 && (
          <p className="w-full text-xs text-severity-error">
            Fix the {errors.length} error finding(s) to enable download. You can still open the draft in the
            workspace to iterate.
          </p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 9: Rewrite `components/import/ImportApp.tsx`** (className-only)

Wordmark heading → display face; the gray subtext → ink-soft; URL input → ink; Import button → ink-btn; the loading spinner border → ember; the gist/picker panels → ink panels; truncation notice → severity-warning ink panel. All logic, `View` state machine, handlers, ids (`repo-url`), and the child components are unchanged.

```tsx
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { stashIncomingSkill } from "@/lib/handoff";
import { createClient, type GitHubClient } from "@/lib/github/client";
import { parseGitHubUrl } from "@/lib/github/url";
import { resolveTarget, type ImportResult, type PickerSkill } from "@/lib/github/importFlow";
import { fetchSkillFiles } from "@/lib/github/fetchSkill";
import type { RepoLink } from "@/lib/github/links";
import TokenField from "./TokenField";
import CollectionAudit from "./CollectionAudit";
import SkillPicker from "./SkillPicker";
import LinksList from "./LinksList";
import ErrorPanel from "./ErrorPanel";

const TOKEN_KEY = "skillsmith:gh-pat";

type View =
  | { s: "idle" }
  | { s: "loading"; step: string }
  | { s: "result"; result: ImportResult }
  | { s: "error"; error: unknown };

export interface ImportAppProps {
  /** Injectable for tests; defaults to the real fetch-backed client. */
  createClientFn?: (opts: { token?: string; fetchFn?: typeof fetch }) => GitHubClient;
}

export default function ImportApp({ createClientFn = createClient }: ImportAppProps) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [token, setToken] = useState("");
  const [view, setView] = useState<View>({ s: "idle" });
  const [busyDir, setBusyDir] = useState<string | null>(null);
  const [tokenOpen, setTokenOpen] = useState(false);

  // Token lives only in localStorage, read/written in the UI layer.
  useEffect(() => {
    try {
      setToken(localStorage.getItem(TOKEN_KEY) ?? "");
    } catch {
      /* storage blocked — degrade to in-memory only */
    }
  }, []);
  function updateToken(t: string) {
    setToken(t);
    try {
      if (t) localStorage.setItem(TOKEN_KEY, t);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignore quota/security errors — spec §11 */
    }
  }

  function makeClient(): GitHubClient {
    return createClientFn({ token: token || undefined, fetchFn: fetch });
  }

  async function run(inputUrl: string) {
    const target = parseGitHubUrl(inputUrl);
    if (!target) {
      setView({ s: "error", error: new Error("That doesn't look like a GitHub repo, gist, or owner/repo.") });
      return;
    }
    setView({ s: "loading", step: "Resolving…" });
    try {
      const result = await resolveTarget(makeClient(), target, (step) => setView({ s: "loading", step }));
      setView({ s: "result", result });
    } catch (error) {
      setView({ s: "error", error });
    }
  }

  async function openSkill(owner: string, repo: string, ref: string, entries: PickerEntries, skill: PickerSkill) {
    setBusyDir(skill.ref.dirPath);
    try {
      const fetched = await fetchSkillFiles(makeClient(), owner, repo, ref, skill.ref, entries);
      stashIncomingSkill(fetched.files, { dirName: fetched.dirName, source: `github:${owner}/${repo}` });
      router.push("/workspace");
    } catch (error) {
      setView({ s: "error", error });
    } finally {
      setBusyDir(null);
    }
  }

  function scanLinkedRepo(link: RepoLink) {
    setUrl(`${link.owner}/${link.repo}`);
    void run(`${link.owner}/${link.repo}`);
  }

  function openGist(result: Extract<ImportResult, { mode: "gist" }>) {
    stashIncomingSkill(result.files, { dirName: result.dirName, source: "github:gist" });
    router.push("/workspace");
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="font-display text-3xl text-ink">Import a skill from GitHub</h1>
      <p className="mt-1 text-sm text-ink-soft">Paste a repo, gist, or owner/repo. Everything runs in your browser.</p>

      <form
        className="mt-4"
        onSubmit={(e) => {
          e.preventDefault();
          void run(url);
        }}
      >
        <label htmlFor="repo-url" className="block text-sm font-medium text-ink">
          Repository URL
        </label>
        <div className="mt-1 flex gap-2">
          <input
            id="repo-url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://github.com/owner/repo"
            className="flex-1 rounded border-2 border-ink bg-paper px-3 py-2 text-ink outline-none focus:border-ember"
          />
          <button type="submit" className="ink-btn px-4 py-2 font-medium">
            Import
          </button>
        </div>
        <TokenField token={token} onChange={updateToken} open={tokenOpen} onToggle={setTokenOpen} />
      </form>

      <section className="mt-6">
        {view.s === "loading" && (
          <div className="flex items-center gap-2 text-sm text-ink-soft">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink/20 border-t-ember" aria-hidden />
            <span>{view.step}</span>
          </div>
        )}

        {view.s === "error" && (
          <ErrorPanel
            error={view.error}
            onNeedToken={() => {
              setTokenOpen(true);
              requestAnimationFrame(() => document.getElementById("gh-token")?.focus());
            }}
          />
        )}

        {view.s === "result" && view.result.mode === "links" && (
          <LinksList links={view.result.links} onScan={scanLinkedRepo} />
        )}

        {view.s === "result" && view.result.mode === "empty" && (
          <p className="text-sm text-ink-soft">{view.result.reason}</p>
        )}

        {view.s === "result" && view.result.mode === "gist" && (
          <div className="ink-panel p-4">
            <p className="text-sm text-ink">
              Gist skill <span className="font-medium">{view.result.dirName}</span> — score{" "}
              {view.result.lint.ok ? view.result.lint.score : "n/a"}.
            </p>
            <button
              type="button"
              onClick={() => openGist(view.result as Extract<ImportResult, { mode: "gist" }>)}
              className="ink-btn mt-2 px-3 py-1 text-sm"
            >
              Open
            </button>
          </div>
        )}

        {view.s === "result" && view.result.mode === "picker" && (
          <div>
            {view.result.truncated && (
              <div className="ink-panel mb-3 p-3 text-sm text-severity-warning">
                This repository is very large; GitHub truncated the file tree, so these results are partial. Import a
                subfolder URL (…/tree/main/path) for complete results.
              </div>
            )}
            <p className="mb-2 text-sm text-ink-soft">
              Found {view.result.skills.length} skill{view.result.skills.length === 1 ? "" : "s"}.
            </p>
            {view.result.skills.length > 3 && <CollectionAudit skills={view.result.skills} />}
            <SkillPicker
              skills={view.result.skills}
              busyDir={busyDir}
              onOpen={(skill) =>
                view.result.mode === "picker" &&
                openSkill(view.result.owner, view.result.repo, view.result.ref, view.result.entries, skill)
              }
            />
          </div>
        )}
      </section>
    </main>
  );
}

type PickerEntries = Extract<ImportResult, { mode: "picker" }>["entries"];
```

- [ ] **Step 10: Rewrite `components/import/TokenField.tsx`** (className-only)

The toggle becomes an ink hand-stroke link; the input → ink. Structure, `id="gh-token"`, and copy unchanged.

```tsx
"use client";

export default function TokenField({
  token,
  onChange,
  open,
  onToggle,
}: {
  token: string;
  onChange: (t: string) => void;
  open: boolean;
  onToggle: (open: boolean) => void;
}) {
  return (
    <div className="mt-2 text-sm">
      <button type="button" onClick={() => onToggle(!open)} className="ink-underline text-ink hover:text-ember">
        {open ? "Hide" : "GitHub token (optional)"}
      </button>
      {open && (
        <div className="mt-2 flex flex-col gap-1">
          <label htmlFor="gh-token" className="text-ink-soft">
            Personal access token — raises the rate limit and unlocks private repos.
          </label>
          <input
            id="gh-token"
            type="password"
            value={token}
            onChange={(e) => onChange(e.target.value)}
            placeholder="ghp_…"
            className="rounded border-2 border-ink bg-paper px-2 py-1 text-ink outline-none focus:border-ember"
            autoComplete="off"
          />
          <span className="text-xs text-ink-soft">Stored locally only, in this browser (localStorage). Never sent anywhere but github.com.</span>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 11: Rewrite `components/import/ErrorPanel.tsx`** (className-only)

Rate-limit/not-found panels become ink panels with severity ink; the "Add a token" links become ink hand-stroke links. Error-class checks and messages unchanged.

```tsx
"use client";
import { GitHubError, NotFoundError, RateLimitError } from "@/lib/github/client";

export default function ErrorPanel({ error, onNeedToken }: { error: unknown; onNeedToken: () => void }) {
  if (error instanceof RateLimitError) {
    const when = error.resetEpoch ? new Date(error.resetEpoch * 1000).toLocaleTimeString() : "soon";
    return (
      <div className="ink-panel p-4">
        <h2 className="font-display text-lg text-severity-warning">GitHub rate limit reached</h2>
        <p className="mt-1 text-sm text-ink">Anonymous requests are limited to 60/hour. Resets around {when}.</p>
        <button type="button" onClick={onNeedToken} className="ink-underline mt-2 text-sm text-ink hover:text-ember">
          Add a token to raise the limit to 5,000/hour
        </button>
      </div>
    );
  }
  if (error instanceof NotFoundError) {
    return (
      <div className="ink-panel p-4">
        <h2 className="font-display text-lg text-severity-error">Import failed</h2>
        <p className="mt-1 text-sm text-ink">{error.message}</p>
        <button type="button" onClick={onNeedToken} className="ink-underline mt-2 text-sm text-ink hover:text-ember">
          Add a token
        </button>
      </div>
    );
  }
  const message =
    error instanceof GitHubError
      ? `GitHub error ${error.status}: ${error.message}`
      : error instanceof Error
        ? error.message
        : "Something went wrong.";
  return (
    <div className="ink-panel p-4">
      <h2 className="font-display text-lg text-severity-error">Import failed</h2>
      <p className="mt-1 text-sm text-ink">{message}</p>
    </div>
  );
}
```

- [ ] **Step 12: Rewrite `components/import/CollectionAudit.tsx`** (className-only — ink table rules)

Panel → ink panel; table header/rows → ink rules; the toggle/sort buttons → ink links. Sorting logic, `useMemo`s, and `PickerSkill` handling unchanged.

```tsx
"use client";
import { useMemo, useState } from "react";
import type { PickerSkill } from "@/lib/github/importFlow";

type SortKey = "name" | "score" | "errors";

export default function CollectionAudit({ skills }: { skills: PickerSkill[] }) {
  const [open, setOpen] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [asc, setAsc] = useState(true); // score ascending = worst first

  const scanned = useMemo(() => skills.filter((s) => s.scanned && s.lint.ok), [skills]);

  const sorted = useMemo(() => {
    const dir = asc ? 1 : -1;
    return [...scanned].sort((a, b) => {
      if (sortKey === "name") return dir * a.ref.name.localeCompare(b.ref.name);
      if (sortKey === "errors") return dir * (a.lint.errors - b.lint.errors);
      return dir * (a.lint.score - b.lint.score);
    });
  }, [scanned, sortKey, asc]);

  function sortBy(key: SortKey) {
    if (key === sortKey) setAsc((v) => !v);
    else {
      setSortKey(key);
      setAsc(true);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="ink-btn mb-3 px-3 py-1 text-sm"
      >
        Audit whole collection ({scanned.length} scanned)
      </button>
    );
  }

  const header = (key: SortKey, label: string) => (
    <th className="py-2 pr-4">
      <button type="button" onClick={() => sortBy(key)} className="ink-underline font-medium text-ink hover:text-ember">
        {label}
      </button>
    </th>
  );

  return (
    <div className="ink-panel mb-4 overflow-x-auto p-3">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-display text-lg text-ink">Collection audit — {scanned.length} skills</h2>
        <button type="button" onClick={() => setOpen(false)} className="ink-underline text-xs text-ink-soft hover:text-ember">
          Hide
        </button>
      </div>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b-2 border-ink text-ink-soft">
            {header("name", "Skill")}
            {header("score", "Score")}
            {header("errors", "Errors")}
          </tr>
        </thead>
        <tbody>
          {sorted.map((s) => (
            <tr key={s.ref.dirPath || s.ref.name} className="border-b border-ink/30">
              <td className="py-2 pr-4 font-medium text-ink">{s.ref.name}</td>
              <td className="py-2 pr-4 font-display text-ink">{s.lint.score}</td>
              <td className="py-2 pr-4 text-ink">{s.lint.errors}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 13: Rewrite `components/import/SkillPicker.tsx`** (className-only — ink table + stamp-mini score)

Keeps `data-testid={mini-score-...}` on the score `<td>` and wraps the number in the display face as a stamp-mini. Origin chip → ink; issue counts → severity ink; Open button → ink-btn. `ORIGIN_LABEL` and all logic unchanged.

```tsx
"use client";
import type { PickerSkill } from "@/lib/github/importFlow";

const ORIGIN_LABEL: Record<string, string> = {
  "skills-dir": "skills-dir",
  "harness-dir": "harness-dir",
  "category-dir": "category-dir",
  root: "root",
  plugin: "plugin",
};

export default function SkillPicker({
  skills,
  busyDir,
  onOpen,
}: {
  skills: PickerSkill[];
  busyDir: string | null;
  onOpen: (skill: PickerSkill) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b-2 border-ink text-ink-soft">
            <th className="py-2 pr-4">Skill</th>
            <th className="py-2 pr-4">Origin</th>
            <th className="py-2 pr-4">Path</th>
            <th className="py-2 pr-4">Score</th>
            <th className="py-2 pr-4">Issues</th>
            <th className="py-2" />
          </tr>
        </thead>
        <tbody>
          {skills.map((s) => (
            <tr key={s.ref.dirPath || s.ref.name} className="border-b border-ink/30">
              <td className="py-2 pr-4 font-medium text-ink">
                {s.ref.name}
                {s.ref.viaSymlink && <span className="ml-1 text-xs text-ink-soft">(symlink)</span>}
              </td>
              <td className="py-2 pr-4">
                <span className="rounded border border-ink px-2 py-0.5 text-xs text-ink">{ORIGIN_LABEL[s.ref.origin]}</span>
                {s.ref.pluginName && <span className="ml-1 text-xs text-ink-soft">{s.ref.pluginName}</span>}
              </td>
              <td className="py-2 pr-4 font-mono text-xs text-ink-soft">{s.ref.dirPath || "(root)"}</td>
              <td className="py-2 pr-4 font-display text-ink" data-testid={`mini-score-${s.ref.dirPath || s.ref.name}`}>
                {s.scanned && s.lint.ok ? s.lint.score : "—"}
              </td>
              <td className="py-2 pr-4 text-xs">
                {s.scanned && s.lint.ok ? (
                  <span>
                    <span className="text-severity-error">{s.lint.errors}E</span> /{" "}
                    <span className="text-severity-warning">{s.lint.warnings}W</span>
                  </span>
                ) : (
                  <span className="text-ink-soft">{s.lint.reason ?? "not scanned"}</span>
                )}
              </td>
              <td className="py-2 text-right">
                <button
                  type="button"
                  disabled={busyDir !== null}
                  onClick={() => onOpen(s)}
                  className="ink-btn px-3 py-1 text-sm"
                >
                  {busyDir === s.ref.dirPath ? "Opening…" : "Open"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 14: Rewrite `components/import/LinksList.tsx`** (className-only)

```tsx
"use client";
import type { RepoLink } from "@/lib/github/links";

export default function LinksList({ links, onScan }: { links: RepoLink[]; onScan: (link: RepoLink) => void }) {
  if (links.length === 0) {
    return <p className="text-sm text-ink-soft">No skills and no linked GitHub repos were found in this repository.</p>;
  }
  return (
    <div>
      <p className="mb-2 text-sm text-ink-soft">
        No SKILL.md here — but this looks like an awesome-list. Pick a linked repo to scan:
      </p>
      <ul className="ink-panel divide-y divide-ink/30">
        {links.map((l) => (
          <li key={`${l.owner}/${l.repo}`} className="flex items-center justify-between px-3 py-2">
            <span className="text-sm text-ink">
              <span className="font-medium">{l.label}</span>{" "}
              <span className="text-ink-soft">
                {l.owner}/{l.repo}
              </span>
            </span>
            <button type="button" onClick={() => onScan(l)} className="ink-btn px-3 py-1 text-sm">
              Scan
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 15: Final verification — full suite + build + visual smoke**

Run: `npm test`
Expected: **all 286+ tests pass, unmodified.** Spot-check the class-sensitive and testid-sensitive ones: `FileTree.test.tsx` (`focus:opacity-100` still asserted true), `ExportButtons.test.tsx`, `app/workspace/page.test.tsx`, `StepReview.test.tsx`, `StepDescription.test.tsx`, `StepContent.test.tsx`, `CollectionAudit.test.tsx`, `ImportApp.test.tsx`, `TokensPanel.test.tsx`, `FindingsPanel.test.tsx`.

Run: `npm run build`
Expected: static export succeeds; `out/` regenerated; fonts inlined at build (no runtime Google request); `out/blacksmith.png` present.

Manual visual smoke checklist (run `npm run dev`, or `npm run start` after build, and eyeball each route):
- [ ] `/` — paper background; blacksmith illustration renders; "Forge better skills." in IM Fell English; two letterpress CTAs heat to ember on hover; three ink-panel feature cards tilt −0.4° on hover; ink divider visible.
- [ ] Header (all pages) — paper strip, 2px ink bottom border, display-face wordmark, nav links draw a hand-stroke underline + ember on hover.
- [ ] `/workspace` — ScoreBadge renders as the rotated double-ring proof stamp with band ink color; panels are paper with ink borders; rule IDs/paths in mono; export buttons letterpress; disabled export reads as pencil; findings severity inks correct; tokens bars are B&W.
- [ ] `/new` — inked step numbers (current = ember); archetype cards as sketch panels (selected = ember outline); fields focus to ember; description/content preview panels are ink; review score in display face; buttons letterpress.
- [ ] `/import` — display-face heading; ink URL field; ember spinner; picker/audit tables use ink rules; mini-scores in display face; error panels use severity ink; buttons letterpress.
- [ ] Global — page reads B&W first; ember appears only on interactive/hot states; `prefers-reduced-motion` (toggle OS setting) stops card/button/underline motion; keyboard focus shows the ember outline.

- [ ] **Step 16: Commit**

```bash
git add app/new/page.tsx components/wizard/ components/import/
git commit -m "feat(ink): re-skin wizard + import surfaces; complete ink restyle"
```

---

## Self-review checklist (author-completed)

- **No placeholders:** every task ships the complete rewritten file; no "adjust classes" prose. The two exceptions (`app/page.tsx` hero, `ScoreBadge`) are the only DOM edits and both derive from the current structure.
- **JSX structure identical outside exceptions:** each restyled file keeps its imports, props, hooks, handlers, `data-testid`s, `id`/`htmlFor`, `aria-*`, and button/label text byte-for-byte; only `className` string contents changed.
- **Test-asserted class preserved:** `FileTree` delete button retains `focus:opacity-100` (the sole asserted class across the suite). No test file is modified.
- **Tailwind 4 `@theme` is CSS-first:** tokens live in `app/globals.css` under `@theme` / `@layer` — no `tailwind.config.js` is introduced. Custom color tokens (`--color-*`) generate `bg-/text-/border-` utilities; font tokens (`--font-*`) generate `font-display/body/mono`.
- **Fonts wired with variable + fallback stacks:** `next/font/google` sets `--font-im-fell`/`--font-alegreya-sans`/`--font-plex-mono` on `<html>`; `@theme` references them with serif/sans/mono fallbacks; self-hosted at build, no runtime request; static export stays green.
- **Ember discipline:** ember is used only for hover/active button fill, focus outline, link hover, drop-zone dragging, and the wizard current-step marker — never on static surfaces; token bars and non-hot severity stay B&W/ink.
```