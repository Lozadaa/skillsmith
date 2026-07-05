<div align="center">

# Skillsmith

**The smith's bench for Claude Agent Skills.**
Inspect, temper, and ship spec-clean `SKILL.md` files — in your browser or your terminal.

[![npm](https://img.shields.io/npm/v/@lozadaa/skillsmith?color=E8590C&label=npx%20%40lozadaa%2Fskillsmith)](https://www.npmjs.com/package/@lozadaa/skillsmith)
[![license](https://img.shields.io/badge/license-MIT-16130E)](#license)
![node](https://img.shields.io/badge/node-%E2%89%A520-16130E)

</div>

---

Skillsmith analyzes [Claude Agent Skills](https://agentskills.io) against the official
best practices: a static linter with **48 rules**, a 0–100 **proof-mark score**, and an
educational **token breakdown** of every part of a skill. The same engine powers two front
ends — a private, static **web app** and a beautiful **terminal app**.

- **Inspect** — instant findings (errors, warnings, suggestions), each with *why it matters* and *how to fix it*.
- **Score** — a single number that tells you how spec-clean a skill is.
- **Tokens** — see exactly what loads into every conversation vs. only when a skill triggers.
- **Temper** — apply auto-fixes for the fixable findings.
- **Private** — analysis runs locally. Nothing is uploaded.

---

## The CLI — `npx @lozadaa/skillsmith`

A guided terminal experience (built on [`@clack/prompts`](https://github.com/bombshell-dev/clack))
that walks the skills already on your machine one by one, opening with a hand-inked blacksmith
banner. **Nothing to install** — one command scans your global or project skills, or any custom path.

```bash
npx @lozadaa/skillsmith
```

```
┌  skillsmith · agent-skill analyzer
│
◇  Choose a source
│  ● Global (~/.claude/skills)   31 skills
│  ○ Project (./.claude/skills)
│  ○ ＋ enter a custom path…
│
◇  Inspect a skill
│  ● ux-writing               ████████░░  82  good        3 findings
│  ○ frontend-design-studio   █████████░  92  excellent   4 findings
│  ○ design-preview-server    █████████░  90  excellent   6 findings
│  ○ ↻ Switch profile (now: claude-code-plugin)
│  ○ ⬇ Export report
│  ○ ✖ Quit
│
◇  ux-writing · 82/100 good
│
│  ⚠ [W07] description is over 500 characters (SKILL.md:3)
│    trim to the essential triggers
│  • [S02] add a "When NOT to use" section
│  tokens · metadata 120 · body 340 · references 0 · total 460
│
└  Forge better skills.
```

### What you can do

| Action | How |
|---|---|
| **Choose a source** | Global (`~/.claude/skills`), Project (`./.claude/skills`), or **type a custom path** |
| **Inspect one by one** | Pick a skill from the list to see its findings + token breakdown, then go back for the next |
| **Browse findings** | Arrow through each warning/finding, `⏎` for its why/how; temper the fixable ones in place |
| **Switch the profile** | The *Switch profile* menu item toggles *Claude Code plugin* ↔ *Generic* (agentskills.io) rules |
| **Apply a fix** | Pick a fixable finding — it writes to disk **after you confirm** |
| **Export a report** | The *Export report* item (or `--export json\|md` from the shell) |

Navigate with the arrow keys, `⏎` to choose, `Ctrl-C` to cancel.

### Lint your project (like ESLint)

`check` is a non-interactive linter: it scans your project's skills, prints problems grouped
per skill (line · severity · message · rule), and **exits non-zero on errors** — drop it into
CI or a pre-commit hook. It defaults to the project's `./.claude/skills` (falls back to global).

```bash
npx @lozadaa/skillsmith check                    # lint ./.claude/skills
npx @lozadaa/skillsmith check --max-warnings 0   # fail on any warning too
npx @lozadaa/skillsmith check --format json > report.json
```

```
ux-writing/SKILL.md
       error    README.md found inside the skill folder  E11
   3   warning  description is 811 characters (soft limit 500)  W03

✖ 19 problems (1 error, 10 warnings, 8 suggestions)
```

**Exit codes:** `0` clean · `1` errors (or warnings over `--max-warnings`) · `2` no skills found.
Output is colored on a real TTY (or with `FORCE_COLOR=1`) and plain when piped, so CI logs stay
clean. `--quiet` reports errors only; `--format compact` gives one `path:line: severity` per line.

### Flags

| Flag | Description |
|---|---|
| `check [path]` | Lint like ESLint: report problems and exit non-zero |
| `--source <global\|local>` | Which `.claude/skills` to scan |
| `--path <dir>` | Treat `<dir>` as the skills root (works even if it *is* a single skill) |
| `--profile <claude-code-plugin\|generic>` | Lint profile (default: `claude-code-plugin`) |
| `--report` | Print a plain dashboard report and exit (no prompts) |
| `--export <json\|md> [path]` | Write a report file and exit |
| `--format <stylish\|compact\|json>` | `check` output format (default: `stylish`) |
| `--max-warnings <n>` | `check`: exit non-zero if warnings exceed `n` |
| `--quiet` | `check`: report errors only |
| `--no-color` | Disable ANSI color |
| `-h, --help` · `-v, --version` | Usage / version |

---

## The web app

A static, account-free web app that does everything the CLI does, plus authoring and importing:

- **Inspect** — paste, upload, or drop a `SKILL.md` (or a folder / `.zip` / `.skill`) for instant findings.
- **Forge** — a guided wizard turns your intent into a valid, well-formed skill from real-world archetypes.
- **Import** — paste any GitHub repo URL to detect its skills and load one onto the bench.
- **Bilingual** — English / Spanish with automatic browser detection and a header toggle.

Everything runs client-side. The only server bit is an optional GitHub OAuth exchange for
publishing skills back to a repo. Live at [skillsmith.richardlozada.dev](https://skillsmith.richardlozada.dev).

### Run it locally

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # static export to out/
npm run start      # serve the export via server.mjs (adds OAuth + caching)
```

---

## The engine

Both front ends share one linter, `lib/skill-lint`:

- **Rules** — errors `E01–E12`, warnings `W01–W21`, suggestions `S01–S15`, some gated by profile.
- **Score** — weighted 0–100 with bands: *excellent · good · needs-work · poor*.
- **Tokens** — a heuristic breakdown: `metadata` (every conversation) · `body` (on trigger) ·
  `references` (only when read) · `scripts` (executed, never loaded).
- **Auto-fixes** — findings can carry an `AutoFix` that both front ends apply.

The CLI bundles this engine (and its UI libraries) at build time via esbuild, so the published
package is a single self-contained file that `npx` runs without an install step.

---

## Repo layout

```
skillsmith/
├── app/                  Next.js App Router pages (home, workspace, import, new)
├── components/           React UI (workspace, wizard, import) + i18n provider
├── lib/
│   ├── skill-lint/       the shared analysis engine (rules, score, tokens, parser)
│   ├── github/           GitHub import/publish client
│   └── i18n.ts           EN/ES string catalog
├── cli/                  @lozadaa/skillsmith — the terminal app
│   ├── src/              scan · analyze · fixes · export · report · check · interactive (clack)
│   ├── scripts/          gen-ascii.py — regenerate the blacksmith banner
│   └── build.mjs         esbuild bundler → dist/skillsmith.mjs
├── server.mjs            zero-dep production server (static export + OAuth + caching)
└── docs/                 specs, plans, and the ink/forge design direction
```

---

## Development

```bash
npm test                       # full suite (web + engine + CLI)

cd cli
npm install                    # esbuild + @clack/prompts + picocolors (dev only, bundled in)
npm run build                  # → dist/skillsmith.mjs
node dist/skillsmith.mjs       # run the CLI locally
```

### Publishing the CLI

```bash
cd cli
npm login
npm publish                    # scoped public; prepublishOnly rebuilds the bundle
```

---

## Design

Skillsmith reads like a page from an inked workshop manual: near-white paper, black pen
linework, and exactly one hot thing — **ember orange** for what's being worked. A dark "night
forge" theme follows your OS. The signature element is the **proof-mark score stamp**. The CLI
carries the same identity into ANSI. See [`docs/design/ink-style.md`](docs/design/ink-style.md).

---

## License

MIT © Richard A. Lozada

<div align="center"><sub>Forge better skills.</sub></div>
