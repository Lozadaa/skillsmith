import type { ParsedSkill, Rule, SkillFile } from "../model";
import { mk } from "./util";

const CAP = 3;

const TOC_RE = /contents|table of contents/i;
const GENERIC_FILENAME = /(^|\/)(doc|file|notes?|temp|misc)\d*\.md$/i;
const SUBDIR_RE = /^(references|reference|resources|examples|scripts|assets)\//;
const RESOURCES_H = /additional resources|resources|references/i;

function nonSkillMd(s: ParsedSkill): SkillFile[] {
  return s.files.filter((f) => f.path !== s.skillFile.path && f.path.toLowerCase().endsWith(".md"));
}

const s05: Rule = {
  id: "S05",
  severity: "suggestion",
  check(s) {
    return nonSkillMd(s)
      .map((f) => ({ f, lines: f.content.split("\n") }))
      .filter(({ lines }) => lines.length > 300 && !TOC_RE.test(lines.slice(0, 30).join("\n")))
      .slice(0, CAP)
      .map(({ f, lines }) =>
        mk("S05", "suggestion",
          `"${f.path}" is ${lines.length} lines with no table of contents`,
          "A long reference is hard for the agent to navigate; a table of contents lets it jump straight to the relevant part.",
          "Add a Contents section listing the reference's headings.",
          { file: f.path })
      );
  },
};

const s06: Rule = {
  id: "S06",
  severity: "suggestion",
  check(s) {
    return s.files
      .filter((f) => GENERIC_FILENAME.test(f.path))
      .slice(0, CAP)
      .map((f) =>
        mk("S06", "suggestion",
          `generic file name "${f.path}"`,
          "Names like doc1.md tell the agent nothing about the file's contents, so it cannot decide whether to read it.",
          "Rename the file after its topic, e.g. api-reference.md.",
          { file: f.path })
      );
  },
};

const s07: Rule = {
  id: "S07",
  severity: "suggestion",
  check(s) {
    const hasSubdirContent = s.files.some((f) => SUBDIR_RE.test(f.path));
    const hasResourcesHeading = s.body.headings.some((h) => RESOURCES_H.test(h.text));
    if (!hasSubdirContent || hasResourcesHeading) return [];
    return [
      mk("S07", "suggestion",
        "supporting files exist but the body has no resources section",
        "Files the body never surfaces are easy for the agent to overlook; a resources section signposts them.",
        "Add an Additional Resources section linking to the supporting files."),
    ];
  },
};

const s12: Rule = {
  id: "S12",
  severity: "suggestion",
  check(s) {
    return s.files
      .filter((f) => f.path.startsWith("scripts/"))
      .filter(
        (f) => !s.body.raw.includes(f.path) && !s.body.links.some((l) => l.target.replace(/^\.\//, "").split("#")[0] === f.path)
      )
      .slice(0, CAP)
      .map((f) =>
        mk("S12", "suggestion",
          `script "${f.path}" is never referenced in SKILL.md`,
          "A script the body never mentions will not be run — the agent has no idea it exists or how to use it.",
          "Document the script in the body: what it does and how to invoke it.",
          { file: f.path })
      );
  },
};

export const suggestionFileRules: Rule[] = [s05, s06, s07, s12];
