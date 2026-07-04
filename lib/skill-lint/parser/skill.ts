import type { ParseOutcome, SkillFile } from "../model";
import { extractFrontmatter } from "./frontmatter";
import { parseBody } from "./markdown";

export interface ParseOptions {
  dirName?: string;
}

export function looksLikeSymlink(f: SkillFile): boolean {
  if (f.symlink === true) return true;
  const c = f.content.trim();
  // A git symlink checked out without symlink support is a single-line relative path.
  return c.length > 0 && c.length < 260 && !c.includes("\n") && !c.includes(" ") && c.includes("/") && !c.startsWith("---");
}

export function parseSkill(files: SkillFile[], opts: ParseOptions = {}): ParseOutcome {
  const candidates = files.filter((f) => !f.path.includes("/") && f.path.toLowerCase() === "skill.md");
  const skillFile = candidates.find((f) => f.path === "SKILL.md") ?? candidates[0];

  if (!skillFile) {
    return { kind: "not-a-skill", reason: "No SKILL.md file found in the skill folder" };
  }
  if (looksLikeSymlink(skillFile)) {
    return {
      kind: "not-a-skill",
      reason: `SKILL.md is a symlink pointing to "${skillFile.content.trim()}" — resolve the link target instead`,
    };
  }

  const extracted = extractFrontmatter(skillFile.content);
  if (!extracted) {
    return {
      kind: "not-a-skill",
      reason: "No YAML frontmatter found (a skill must start with --- on line 1)",
    };
  }

  return {
    kind: "skill",
    skill: {
      dirName: opts.dirName,
      filenameAsGiven: skillFile.path,
      skillFile,
      frontmatter: extracted.frontmatter,
      body: parseBody(extracted.bodyRaw, extracted.bodyStartLine),
      files,
    },
  };
}
