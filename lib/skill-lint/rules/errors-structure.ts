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
      if (/^[ \t]*\t/.test(l)) {
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
