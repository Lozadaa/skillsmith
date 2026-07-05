// Pure render: (State, Theme) -> full-screen string. Discipline: pad/truncate on
// PLAIN text first, then apply color, so ANSI codes never break column math.
import type { Severity } from "../../../lib/skill-lint";
import { listSkillDirs } from "../scan";
import type { Theme } from "./theme";
import { EMBER } from "./theme";
import { State, orderedFindings, selectedSkill } from "./state";

const pad = (s: string, w: number): string => (s.length > w ? s.slice(0, w - 1) + "…" : s.padEnd(w));

/** Slice a list to a visible window centered on the cursor. */
function windowSlice(total: number, cursor: number, height: number): { start: number; end: number } {
  if (total <= height) return { start: 0, end: total };
  const start = Math.max(0, Math.min(cursor - Math.floor(height / 2), total - height));
  return { start, end: start + height };
}

const mark = (t: Theme, sev: Severity): string => {
  const u = t.caps.unicode;
  const ch = sev === "error" ? (u ? "✖" : "x") : sev === "warning" ? (u ? "⚠" : "!") : u ? "•" : "-";
  return t.severity(sev, ch);
};

function chrome(t: Theme, title: string, body: string[], footer: string): string {
  const rule = t.dim(t.box.h.repeat(Math.min(60, Math.max(20, title.length + 4))));
  return ["", "  " + title, "  " + rule, "", ...body.map((l) => "  " + l), "", "  " + t.dim(footer)].join("\n");
}

function renderSource(s: State, t: Theme): string {
  const cur = t.caps.unicode ? "▸" : ">";
  const body = s.sources.map((src, i) => {
    const n = listSkillDirs(src.root).length;
    const point = i === s.cursor ? t.fg(EMBER, cur) : " ";
    const label = i === s.cursor ? t.fg(EMBER, pad(src.label, 32)) : pad(src.label, 32);
    return `${point} ${label} ${t.dim(`${n} skill${n === 1 ? "" : "s"}`)}`;
  });
  // Trailing row: enter a custom path.
  const customIdx = s.sources.length;
  const cpoint = s.cursor === customIdx ? t.fg(EMBER, cur) : " ";
  const clabel = `${t.caps.unicode ? "＋" : "+"} enter a custom path…`;
  body.push(`${cpoint} ${s.cursor === customIdx ? t.fg(EMBER, clabel) : t.dim(clabel)}`);
  const title = s.sources.length ? "choose a source" : "no default skills found — add a custom path";
  return chrome(t, t.bold(t.fg(EMBER, "skillsmith")) + t.dim("  " + title), body, "↑↓ move   ⏎ select   q quit");
}

function renderInput(s: State, t: Theme): string {
  const caret = t.caps.unicode ? "▏" : "|";
  const body = [
    t.dim("Path to a skill folder, or a folder that contains skills:"),
    "",
    `  ${t.fg(EMBER, (s.input || "") + caret)}`,
    "",
    t.dim("~ expands to your home directory"),
  ];
  return chrome(t, t.fg(EMBER, "custom path"), body, "⏎ scan   esc cancel");
}

function renderList(s: State, t: Theme): string {
  const cur = t.caps.unicode ? "▸" : ">";
  const dot = t.caps.unicode ? "·" : "-";
  const header =
    t.bold(t.fg(EMBER, "skillsmith")) +
    `  ${s.source?.label} ${dot} ${s.skills.length} skills ${dot} profile ${s.profile}`;
  const nameW = Math.min(26, Math.max(10, ...s.skills.map((k) => k.dirName.length)));
  const row = (k: State["skills"][number], i: number) => {
    const point = i === s.cursor ? t.fg(EMBER, cur) : " ";
    const name = i === s.cursor ? t.bold(pad(k.dirName, nameW)) : pad(k.dirName, nameW);
    if (k.outcome.kind !== "skill") return `${point} ${name}  ${t.dim("not a skill")}`;
    const { value, band } = k.outcome.score;
    const n = k.outcome.findings.length;
    return `${point} ${name}  ${t.bar(value, 10)} ${t.band(band, String(value).padStart(3))}  ${t.band(
      band,
      pad(band, 11)
    )} ${t.dim(`${n}`)}`;
  };
  // Viewport: window the rows around the cursor so long lists don't overflow.
  const height = Math.max(3, s.rows - 9);
  const { start, end } = windowSlice(s.skills.length, s.cursor, height);
  const body: string[] = [];
  if (start > 0) body.push(t.dim(`↑ ${start} more`));
  s.skills.slice(start, end).forEach((k, j) => body.push(row(k, start + j)));
  if (end < s.skills.length) body.push(t.dim(`↓ ${s.skills.length - end} more`));
  return chrome(t, header, body, "↑↓ move   ⏎ inspect   p profile   e export   esc source   q quit");
}

function stamp(t: Theme, value: number, band: string): string[] {
  const b = t.box;
  const line = (inner: string) => `${b.v} ${t.band(band as never, inner.padEnd(9))} ${b.v}`;
  const top = b.tl + b.h.repeat(11) + b.tr;
  const bot = b.bl + b.h.repeat(11) + b.br;
  return [top, line(`${value}/100`), line(band), bot];
}

function renderDetail(s: State, t: Theme): string {
  const skill = selectedSkill(s);
  const back = t.caps.unicode ? "←" : "<";
  if (!skill || skill.outcome.kind !== "skill") {
    return chrome(t, `${back} ${skill?.dirName ?? ""}`, [t.dim("Not a skill.")], "esc back   q quit");
  }
  const o = skill.outcome;
  const findings = orderedFindings(o);
  const wrench = t.caps.unicode ? " ⚒" : " *";
  const body: string[] = [];
  for (const l of stamp(t, o.score.value, o.score.band)) body.push(l);
  body.push("");
  body.push(t.bold(`Findings (${findings.length})`));
  if (!findings.length) body.push(t.dim("  clean — passes every enabled rule"));
  findings.forEach((f, i) => {
    const sel = i === s.findingCursor;
    const point = sel ? t.fg(EMBER, t.caps.unicode ? "▸" : ">") : " ";
    const loc = f.line ? t.dim(` (${f.file ?? "SKILL.md"}:${f.line})`) : "";
    const fix = f.fix ? t.fg(EMBER, wrench) : "";
    body.push(`${point} ${mark(t, f.severity)} ${t.dim(`[${f.ruleId}]`)} ${f.message}${loc}${fix}`);
    if (sel) {
      body.push(`      ${t.dim("why:")} ${f.why}`);
      body.push(`      ${t.dim("fix:")} ${f.howToFix}`);
    }
  });
  body.push("");
  const tk = o.tokens;
  const dot = t.caps.unicode ? "·" : "-";
  body.push(
    t.dim(
      `Tokens  metadata ${tk.metadata} ${dot} body ${tk.body} ${dot} references ${tk.references} ${dot} scripts ${tk.scriptFiles} ${dot} total ${tk.total}`
    )
  );
  const footer = "↑↓ finding   f temper (apply fix)   e export   esc back   q quit";
  return chrome(t, `${back} ${t.bold(skill.dirName)}   ${t.dim("profile " + s.profile)}`, body, footer);
}

function renderConfirm(s: State, t: Theme): string {
  const p = s.confirm?.preview;
  const body = [
    `${t.bold("Apply fix:")} ${p?.label ?? ""}`,
    "",
    t.dim("Will write to disk:"),
    ...(p?.changed ?? []).map((c) => `  ${t.fg(EMBER, c)}`),
  ];
  return chrome(t, t.fg(EMBER, "temper"), body, "y confirm   n cancel");
}

function renderHelp(t: Theme): string {
  const rows = [
    "↑ / ↓ , j / k   move",
    "⏎               select / inspect",
    "esc / ←         back",
    "p               toggle profile (generic ↔ claude-code-plugin)",
    "f               apply fix to the selected finding (writes to disk)",
    "e               export the source report (markdown)",
    "?               this help",
    "q / Ctrl-C      quit",
  ];
  return chrome(t, t.fg(EMBER, "keys"), rows, "esc back");
}

export function render(s: State, t: Theme): string {
  let screen: string;
  switch (s.screen) {
    case "source": screen = renderSource(s, t); break;
    case "input": screen = renderInput(s, t); break;
    case "list": screen = renderList(s, t); break;
    case "detail": screen = renderDetail(s, t); break;
    case "confirm": screen = renderConfirm(s, t); break;
    case "help": screen = renderHelp(t); break;
  }
  return s.message ? screen + "\n\n  " + t.fg(EMBER, s.message) : screen;
}
