// Entry point: parse flags, resolve sources, then either run the interactive TUI
// (TTY) or print a plain report (pipe/CI/--report). --export writes a file.
import type { Profile } from "../../lib/skill-lint";
import { resolveSources, type SourceRef } from "./scan";
import { analyzeSource, errorCount } from "./analyze";
import { renderReport } from "./report";
import { toJson, toMarkdown, writeReport } from "./export";
import { detectCaps, makeTheme } from "./tui/theme";
import { runInteractive } from "./interactive";
import { runCheck, type CheckOptions } from "./check";

// Replaced at build time by esbuild's define from package.json (see build.mjs).
declare const __CLI_VERSION__: string;
const VERSION = typeof __CLI_VERSION__ === "string" ? __CLI_VERSION__ : "0.0.0-dev";

const argv = process.argv.slice(2);
const has = (f: string) => argv.includes(f);
const val = (f: string): string | undefined => {
  const i = argv.indexOf(f);
  return i >= 0 ? argv[i + 1] : undefined;
};

const HELP = `skillsmith — analyze Claude Agent Skills in your terminal

Usage
  npx @lozadaa/skillsmith [check] [options]

Commands
  (default)                   open the interactive analyzer (on a TTY)
  check [path]                lint like ESLint: report problems, exit non-zero on errors

Options
  --source <global|local>     which .claude/skills to scan
  --path <dir>                treat <dir> as the skills root
  --profile <claude-code-plugin|generic>   lint profile (default: claude-code-plugin)
  --report                    print a plain dashboard report and exit
  --export <json|md> [path]   write a report file and exit
  --format <stylish|compact|json>   check output format (default: stylish)
  --max-warnings <n>          check: exit non-zero if warnings exceed n
  --quiet                     check: report errors only
  --no-color                  disable ANSI color
  -h, --help                  show this help
  -v, --version               show version

check defaults to the project's ./.claude/skills (falls back to global), so in CI:
  npx @lozadaa/skillsmith check --max-warnings 0

Keys (interactive)
  ↑↓/jk move · ⏎ inspect · p profile · f apply fix · e export · esc back · q quit`;

function parseProfile(): Profile {
  // Default to the Claude Code plugin profile; --profile generic opts out.
  return val("--profile") === "generic" ? "generic" : "claude-code-plugin";
}

function pickSources(): SourceRef[] {
  const all = resolveSources(process.cwd(), val("--path"));
  const want = val("--source");
  return want ? all.filter((s) => s.id === want) : all;
}

/** `skillsmith check [path]` — ESLint-style linter: project-first, exit-coded. */
function runCheckCommand(profile: Profile): never {
  const posPath = argv[1] && !argv[1].startsWith("-") ? argv[1] : undefined;
  const pathRoot = val("--path") ?? posPath;
  const all = resolveSources(process.cwd(), pathRoot);
  const want = val("--source");
  const source = want
    ? all.find((s) => s.id === want)
    : pathRoot
      ? all[0]
      : (all.find((s) => s.id === "local") ?? all.find((s) => s.id === "global"));
  if (!source) {
    console.error(
      "No skills found. Run inside a project with ./.claude/skills, or: skillsmith check <dir>"
    );
    process.exit(2); // usage/config error, distinct from lint failures (1)
  }

  const fmt = val("--format");
  const opts: CheckOptions = {
    format: fmt === "json" ? "json" : fmt === "compact" ? "compact" : "stylish",
    maxWarnings: val("--max-warnings") != null ? Number(val("--max-warnings")) : Infinity,
    quiet: has("--quiet"),
  };
  const skills = analyzeSource(source, profile);
  const theme = makeTheme(detectCaps({ noColor: has("--no-color"), isTTY: process.stdout.isTTY }));
  if (opts.format !== "json") {
    process.stdout.write(
      theme.dim(`skillsmith · ${source.label} · ${skills.length} skills · profile ${profile}`) + "\n\n"
    );
  }
  const { text, exitCode } = runCheck(skills, opts, theme);
  process.stdout.write(text + "\n");
  process.exit(exitCode);
}

function main(): void {
  if (has("--help") || has("-h")) return console.log(HELP);
  if (has("--version") || has("-v")) return console.log(VERSION);

  const profile = parseProfile();

  const cmd = argv[0] && !argv[0].startsWith("-") ? argv[0] : undefined;
  if (cmd === "check" || cmd === "lint") runCheckCommand(profile);

  const sources = pickSources();
  const noSources = () => {
    console.error("No .claude/skills found. Pass --path <dir> to point at a custom location.");
    process.exit(0);
  };

  // --export: write a file for the first (or --source-filtered) source and exit.
  const exportIdx = argv.indexOf("--export");
  if (exportIdx >= 0) {
    if (sources.length === 0) noSources();
    const fmt = argv[exportIdx + 1] === "json" ? "json" : "md";
    const maybePath = argv[exportIdx + 2];
    const path = maybePath && !maybePath.startsWith("-") ? maybePath : `./skillsmith-report.${fmt}`;
    const source = sources[0];
    const skills = analyzeSource(source, profile);
    const meta = { source: source.label, profile, generatedAt: new Date().toISOString() };
    writeReport(path, fmt === "json" ? toJson(skills, meta) : toMarkdown(skills, meta));
    console.log(`Wrote ${path}`);
    process.exit(0);
  }

  // Report mode: explicit --report or a non-interactive stdout (pipe/CI).
  if (has("--report") || !process.stdout.isTTY) {
    if (sources.length === 0) noSources();
    const source = sources[0];
    const skills = analyzeSource(source, profile);
    const theme = makeTheme(detectCaps({ noColor: has("--no-color"), isTTY: process.stdout.isTTY }));
    process.stdout.write(renderReport(skills, { sourceLabel: source.label, profile }, theme) + "\n");
    process.exit(errorCount(skills) > 0 ? 1 : 0);
  }

  // Interactive experience (@clack/prompts).
  runInteractive(sources, profile).then(() => process.exit(0));
}

main();
