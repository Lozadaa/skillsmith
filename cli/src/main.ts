// Entry point: parse flags, resolve sources, then either run the interactive TUI
// (TTY) or print a plain report (pipe/CI/--report). --export writes a file.
import type { Profile } from "../../lib/skill-lint";
import { resolveSources, type SourceRef } from "./scan";
import { analyzeSource, errorCount } from "./analyze";
import { renderReport } from "./report";
import { toJson, toMarkdown, writeReport } from "./export";
import { detectCaps, makeTheme } from "./tui/theme";
import { runTui } from "./tui/app";

const VERSION = "0.1.0";

const argv = process.argv.slice(2);
const has = (f: string) => argv.includes(f);
const val = (f: string): string | undefined => {
  const i = argv.indexOf(f);
  return i >= 0 ? argv[i + 1] : undefined;
};

const HELP = `skillsmith — analyze Claude Agent Skills in your terminal

Usage
  npx @lozadaa/skillsmith [options]

Options
  --source <global|local>     which .claude/skills to scan
  --path <dir>                treat <dir> as the skills root
  --profile <generic|claude-code-plugin>   lint profile (default: generic)
  --report                    print a plain report and exit (no TUI)
  --export <json|md> [path]   write a report file and exit
  --no-color                  disable ANSI color
  -h, --help                  show this help
  -v, --version               show version

Keys (interactive)
  ↑↓/jk move · ⏎ inspect · p profile · f apply fix · e export · esc back · q quit`;

function parseProfile(): Profile {
  const p = val("--profile");
  return p === "claude-code-plugin" ? "claude-code-plugin" : "generic";
}

function pickSources(): SourceRef[] {
  const all = resolveSources(process.cwd(), val("--path"));
  const want = val("--source");
  return want ? all.filter((s) => s.id === want) : all;
}

function main(): void {
  if (has("--help") || has("-h")) return console.log(HELP);
  if (has("--version") || has("-v")) return console.log(VERSION);

  const profile = parseProfile();
  const sources = pickSources();

  if (sources.length === 0) {
    console.error("No .claude/skills found (global ~/.claude/skills or ./.claude/skills).");
    process.exit(0);
  }

  // --export: write a file for the first (or --source-filtered) source and exit.
  const exportIdx = argv.indexOf("--export");
  if (exportIdx >= 0) {
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
    const source = sources[0];
    const skills = analyzeSource(source, profile);
    const theme = makeTheme(detectCaps({ noColor: has("--no-color"), isTTY: process.stdout.isTTY }));
    process.stdout.write(renderReport(skills, { sourceLabel: source.label, profile }, theme) + "\n");
    process.exit(errorCount(skills) > 0 ? 1 : 0);
  }

  // Interactive TUI.
  const theme = makeTheme(detectCaps({ noColor: has("--no-color"), isTTY: true }));
  runTui(sources, profile, theme).then(() => process.exit(0));
}

main();
