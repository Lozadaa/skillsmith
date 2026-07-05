<div align="center">

# 🔨 Skillsmith

**The smith's bench for Claude Agent Skills.**
Inspect, temper, and ship spec-clean `SKILL.md` files — in your browser or your terminal.

[![npm](https://img.shields.io/npm/v/@lozadaa/skillsmith?color=E8590C&label=npx%20%40lozadaa%2Fskillsmith)](https://www.npmjs.com/package/@lozadaa/skillsmith)
[![license](https://img.shields.io/badge/license-MIT-16130E)](#license)
![node](https://img.shields.io/badge/node-%E2%89%A520-16130E)
![zero deps](https://img.shields.io/badge/runtime%20deps-0-E8590C)

</div>

---

Skillsmith analyzes [Claude Agent Skills](https://agentskills.io) against the official
best practices: a static linter with **48 rules**, a 0–100 **proof-mark score**, and an
educational **token breakdown** of every part of a skill. The same engine powers two front
ends — a private, static **web app** and a beautiful, install-free **terminal app**.

- 🔍 **Inspect** — instant findings (errors, warnings, suggestions), each with *why it matters* and *how to fix it*.
- 🏷️ **Score** — a single number that tells you how spec-clean a skill is.
- 🪙 **Tokens** — see exactly what loads into every conversation vs. only when a skill triggers.
- ⚒️ **Temper** — apply auto-fixes for the fixable findings.
- 🔒 **Private** — analysis runs locally. Nothing is uploaded.

---

## 🖥️ The CLI — `npx @lozadaa/skillsmith`

A gorgeous terminal analyzer for the skills already on your machine. **No install, zero runtime
dependencies** — one command scans your global or project skills and walks them one by one.

```bash
npx @lozadaa/skillsmith
```

```
┌ skillsmith · Global (~/.claude/skills) · 31 skills · profile generic
│
│ ▸ ux-writing               ████████░░   82  good         3
│   frontend-design-studio   █████████░   92  excellent    4
│   design-preview-server    █████████░   90  excellent    6
│   ＋ enter a custom path…
│
│ ↑↓ move   ⏎ inspect   p profile   e export   esc source   q quit
└─
```

Press `⏎` on a skill to inspect it:

```
┌ ← ux-writing                                     profile generic
│ ┌─────────┐
│ │  82/100 │   good
│ │  Good   │
│ └─────────┘
│ Findings (3)
│ ▸ ⚠ [W07] description is over 500 characters (SKILL.md:3) ⚒
│       why: long descriptions dilute triggering
│       fix: trim to the essential triggers, aim for under 500
│   • [S02] add a "When NOT to use" section
│ Tokens  metadata 120 · body 340 · references 0 · scripts 0 · total 460
│ ↑↓ finding   f temper (apply fix)   e export   esc back   q quit
└─
```

### What you can do

| Action | How |
|---|---|
| **Choose a source** | Global (`~/.claude/skills`), Project (`./.claude/skills`), or **type a custom path** |
| **Inspect one by one** | Arrow through the list, `⏎` to open a skill's findings + token breakdown |
| **Toggle the profile** | `p` switches between *Generic* (agentskills.io) and *Claude Code plugin* rules |
| **Apply a fix** | `f` on a fixable finding (marked `⚒`) — writes to disk **after you confirm** |
| **Export a report** | `e` in the app, or `--export json\|md` from the shell |

### Flags

| Flag | Description |
|---|---|
| `--source <global\|local>` | Which `.claude/skills` to scan |
| `--path <dir>` | Treat `<dir>` as the skills root (works even if it *is* a single skill) |
| `--profile <generic\|claude-code-plugin>` | Lint profile (default: `generic`) |
| `--report` | Print a plain report and exit (no TUI) |
| `--export <json\|md> [path]` | Write a report file and exit |
| `--no-color` | Disable ANSI color |
| `-h, --help` · `-v, --version` | Usage / version |

### Built for CI

Piped or non-interactive output automatically falls back to a plain report and **exits `1`
when any error-severity finding exists** — drop it straight into a pipeline:

```bash
npx @lozadaa/skillsmith --report --source local || echo "skills need work"
```

The terminal UI adapts to your environment: **truecolor → 16-color → no-color → ASCII**, and
color is emitted only on a real TTY (or with `FORCE_COLOR=1`), so redirected output stays clean.

---

## 🌐 The web app

A static, account-free web app that does everything the CLI does, plus authoring and importing:

- **Inspect** — paste, upload, or drop a `SKILL.md` (or a folder / `.zip` / `.skill`) for instant findings.
- **Forge** — a guided wizard turns your intent into a valid, well-formed skill from real-world archetypes.
- **Import** — paste any GitHub repo URL to detect its skills and load one onto the bench.
- **Bilingual** — English / Spanish with automatic browser detection and a header toggle.

Everything runs client-side. The only server bit is an optional GitHub OAuth exchange for
publishing skills back to a repo.

### Run it locally

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # static export to out/
npm run start      # serve the export via server.mjs (adds OAuth + caching)
```

---

## 🧠 The engine

Both front ends share one linter, `lib/skill-lint`:

- **Rules** — errors `E01–E12`, warnings `W01–W21`, suggestions `S01–S15`, some gated by profile.
- **Score** — weighted 0–100 with bands: *excellent · good · needs-work · poor*.
- **Tokens** — a heuristic breakdown: `metadata` (every conversation) · `body` (on trigger) ·
  `references` (only when read) · `scripts` (executed, never loaded).
- **Auto-fixes** — findings can carry an `AutoFix` that both front ends apply.

The CLI bundles this engine at build time (via esbuild), so the published package is a single
self-contained file with **no runtime dependencies**.

---

## 🗂️ Repo layout

```
skillsmith/
├── app/                  Next.js App Router pages (home, workspace, import, new)
├── components/           React UI (workspace, wizard, import) + i18n provider
├── lib/
│   ├── skill-lint/       the shared analysis engine (rules, score, tokens, parser)
│   ├── github/           GitHub import/publish client
│   └── i18n.ts           EN/ES string catalog
├── cli/                  @lozadaa/skillsmith — the terminal app
│   ├── src/              scan · analyze · fixes · export · report · tui/
│   └── build.mjs         esbuild bundler → dist/skillsmith.mjs
├── server.mjs            zero-dep production server (static export + OAuth + caching)
└── docs/                 specs, plans, and the ink/forge design direction
```

---

## 🛠️ Development

```bash
npm test                       # full suite (web + engine + CLI), 390+ tests

cd cli
npm install                    # esbuild (dev only)
npm run build                  # → dist/skillsmith.mjs
node dist/skillsmith.mjs       # run the TUI locally
```

### Publishing the CLI

```bash
cd cli
npm login
npm publish                    # scoped public; prepublishOnly rebuilds the bundle
```

---

## 🎨 Design

Skillsmith reads like a page from an inked workshop manual: near-white paper, black pen
linework, and exactly one hot thing — **ember orange** for what's being worked. A dark "night
forge" theme follows your OS. The signature element is the **proof-mark score stamp**. The CLI
carries the same identity into ANSI. See [`docs/design/ink-style.md`](docs/design/ink-style.md).

---

## License

MIT © Richard A. Lozada

<div align="center"><sub>Forge better skills. 🔨</sub></div>
