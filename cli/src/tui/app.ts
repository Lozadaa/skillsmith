// Interactive loop: raw-mode stdin -> state transitions -> full repaint. Uses the
// alternate screen buffer so the terminal is restored cleanly on exit.
import type { Profile } from "../../../lib/skill-lint";
import type { SourceRef } from "../scan";
import { analyzeSource, relint } from "../analyze";
import { previewFix, commitFix } from "../fixes";
import { toMarkdown, writeReport } from "../export";
import { parseKey } from "./keys";
import { render } from "./render";
import { State, orderedFindings, selectedSkill } from "./state";
import type { Theme } from "./theme";

export function runTui(sources: SourceRef[], profile: Profile, theme: Theme): Promise<void> {
  return new Promise((resolve) => {
    const out = process.stdout;
    const stdin = process.stdin;
    const state: State = {
      sources,
      profile,
      skills: [],
      screen: "source",
      cursor: 0,
      findingCursor: 0,
      cols: out.columns || 80,
      rows: out.rows || 24,
    };

    const selectSource = (i: number) => {
      state.source = state.sources[i];
      state.skills = analyzeSource(state.source, state.profile);
      state.screen = "list";
      state.cursor = 0;
    };

    if (sources.length === 1) selectSource(0);

    const listLen = () => state.skills.length;
    const findingLen = () => {
      const k = selectedSkill(state);
      return k && k.outcome.kind === "skill" ? orderedFindings(k.outcome).length : 0;
    };
    const clamp = (n: number, max: number) => Math.max(0, Math.min(max - 1, n));
    const clampFinding = () => {
      state.findingCursor = Math.max(0, Math.min(Math.max(0, findingLen() - 1), state.findingCursor));
    };

    const toggleProfile = () => {
      state.profile = state.profile === "generic" ? "claude-code-plugin" : "generic";
      state.skills = state.skills.map((k) => relint(k, state.profile));
      clampFinding();
      state.message = "profile: " + state.profile;
    };

    const exportReport = () => {
      if (!state.source) return;
      const path = "./skillsmith-report.md";
      writeReport(
        path,
        toMarkdown(state.skills, {
          source: state.source.label,
          profile: state.profile,
          generatedAt: new Date().toISOString(),
        })
      );
      state.message = "exported " + path;
    };

    const startFix = () => {
      const skill = selectedSkill(state);
      if (!skill || skill.outcome.kind !== "skill") return;
      const finding = orderedFindings(skill.outcome)[state.findingCursor];
      if (!finding) return;
      const preview = previewFix(skill, finding);
      if (!preview) return void (state.message = "no automatic fix for this finding");
      if (!preview.changed.length) return void (state.message = "fix produces no change");
      state.confirm = { preview };
      state.screen = "confirm";
    };

    const confirmFix = () => {
      const skill = selectedSkill(state);
      if (skill && state.confirm) {
        state.skills[state.cursor] = commitFix(skill, state.confirm.preview, state.profile);
        state.message = "tempered · " + skill.dirName;
      }
      state.confirm = undefined;
      state.screen = "detail";
      clampFinding();
    };

    const paint = () => out.write("\x1b[2J\x1b[H" + render(state, theme));
    const onResize = () => {
      state.cols = out.columns || 80;
      state.rows = out.rows || 24;
      paint();
    };

    const cleanup = () => {
      stdin.off("data", onData);
      out.off("resize", onResize);
      if (stdin.isTTY) stdin.setRawMode(false);
      stdin.pause();
      out.write("\x1b[?25h\x1b[?1049l"); // show cursor, leave alternate screen
    };
    const quit = () => {
      cleanup();
      resolve();
    };

    function onData(data: Buffer | string) {
      const key = parseKey(data);
      state.message = undefined;
      if (key === "ctrl-c" || (key === "q" && state.screen !== "confirm")) return quit();
      const up = key === "up" || key === "k";
      const down = key === "down" || key === "j";
      const back = key === "esc" || key === "left";

      switch (state.screen) {
        case "source":
          if (up) state.cursor = clamp(state.cursor - 1, state.sources.length);
          else if (down) state.cursor = clamp(state.cursor + 1, state.sources.length);
          else if (key === "enter") selectSource(state.cursor);
          break;
        case "list":
          if (up) state.cursor = clamp(state.cursor - 1, listLen());
          else if (down) state.cursor = clamp(state.cursor + 1, listLen());
          else if (key === "enter") {
            state.findingCursor = 0;
            state.screen = "detail";
          } else if (key === "p") toggleProfile();
          else if (key === "e") exportReport();
          else if (key === "?") state.screen = "help";
          else if (back) {
            if (state.sources.length > 1) state.screen = "source";
            else return quit();
          }
          break;
        case "detail":
          if (up) state.findingCursor = clamp(state.findingCursor - 1, findingLen());
          else if (down) state.findingCursor = clamp(state.findingCursor + 1, findingLen());
          else if (key === "f") startFix();
          else if (key === "p") toggleProfile();
          else if (key === "e") exportReport();
          else if (key === "?") state.screen = "help";
          else if (back) state.screen = "list";
          break;
        case "confirm":
          if (key === "y") confirmFix();
          else if (key === "n" || back || key === "q") {
            state.confirm = undefined;
            state.screen = "detail";
          }
          break;
        case "help":
          if (back || key === "enter" || key === "?") state.screen = state.source ? "list" : "source";
          break;
      }
      paint();
    }

    out.write("\x1b[?1049h\x1b[?25l"); // alternate screen, hide cursor
    if (stdin.isTTY) stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    stdin.on("data", onData);
    out.on("resize", onResize);
    paint();
  });
}
