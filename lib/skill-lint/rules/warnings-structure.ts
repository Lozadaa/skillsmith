import type { Finding, ParsedSkill, Rule, SkillFile } from "../model";
import { mk } from "./util";
import { parseBody } from "../parser/markdown";
import { looksLikeSymlink } from "../parser/skill";

const CAP = 5;

const SECRET_PATTERNS: { name: string; re: RegExp }[] = [
  { name: "Anthropic API key", re: /sk-ant-[A-Za-z0-9-]{10,}/ },
  { name: "AWS access key id", re: /AKIA[0-9A-Z]{16}/ },
  { name: "GitHub token", re: /ghp_[A-Za-z0-9]{36}/ },
  { name: "Google API key", re: /AIza[0-9A-Za-z_-]{35}/ },
  { name: "private key block", re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: "inline api key", re: /\bapi[_-]?key\s*[:=]\s*["'][A-Za-z0-9_\-]{16,}["']/i },
];

function isRelative(t: string): boolean {
  return !/^(https?:|mailto:|#|\/)/.test(t);
}

function dirOf(path: string): string {
  const i = path.lastIndexOf("/");
  return i === -1 ? "" : path.slice(0, i);
}

/** Resolve a relative link target against a base directory, collapsing ./ and ../ */
function resolveRelative(fromDir: string, target: string): string {
  const clean = target.replace(/^\.\//, "").split("#")[0];
  const parts = fromDir === "" ? [] : fromDir.split("/");
  for (const seg of clean.split("/")) {
    if (seg === "..") parts.pop();
    else if (seg === "" || seg === ".") continue;
    else parts.push(seg);
  }
  return parts.join("/");
}

function normalizeTarget(t: string): string {
  return t.replace(/^\.\//, "").split("#")[0];
}

function nonSkillMd(s: ParsedSkill): SkillFile[] {
  return s.files.filter((f) => f.path !== s.skillFile.path && f.path.toLowerCase().endsWith(".md"));
}

function isJunk(p: string): boolean {
  return p.includes("__pycache__/") || p.includes("node_modules") || p.includes(".DS_Store") || p.endsWith(".pyc");
}

const w10: Rule = {
  id: "W10",
  severity: "warning",
  check(s) {
    const paths = new Set(s.files.map((f) => f.path));
    const out: Finding[] = [];
    for (const f of nonSkillMd(s)) {
      if (out.length >= CAP) break;
      const body = parseBody(f.content, 1);
      const deep = body.links.find((link) => {
        if (!isRelative(link.target)) return false;
        if (!normalizeTarget(link.target).toLowerCase().endsWith(".md")) return false;
        const resolved = resolveRelative(dirOf(f.path), link.target);
        return resolved !== "" && resolved !== f.path && paths.has(resolved);
      });
      if (deep) {
        out.push(
          mk("W10", "warning",
            `Reference "${f.path}" links to another skill file ("${deep.target}")`,
            "Progressive disclosure works best one level deep; references that point to further references make the load path hard to follow.",
            "Flatten the structure so SKILL.md links to each reference directly.",
            { file: f.path, line: deep.line })
        );
      }
    }
    return out;
  },
};

const w11: Rule = {
  id: "W11",
  severity: "warning",
  check(s) {
    const linked = new Set(
      s.body.links.filter((l) => isRelative(l.target)).map((l) => normalizeTarget(l.target))
    );
    return nonSkillMd(s)
      .filter((f) => !linked.has(f.path))
      .slice(0, CAP)
      .map((f) =>
        mk("W11", "warning",
          `"${f.path}" is never linked from SKILL.md`,
          "An orphan reference file is invisible to Claude — nothing points to it, so it is never read.",
          `Link it from SKILL.md (e.g. [${f.path}](${f.path})) or remove it.`,
          { file: f.path })
      );
  },
};

const w17: Rule = {
  id: "W17",
  severity: "warning",
  check(s) {
    return s.files
      .filter((f) => looksLikeSymlink(f))
      .slice(0, CAP)
      .map((f) =>
        mk("W17", "warning",
          `"${f.path}" looks like a symlink`,
          "Symlinks do not survive zip packaging or Windows checkouts, so a symlinked skill silently breaks when distributed.",
          "Replace the symlink with the real file contents before packaging.",
          { file: f.path })
      );
  },
};

const w18: Rule = {
  id: "W18",
  severity: "warning",
  check(s) {
    return s.files
      .filter((f) => isJunk(f.path))
      .slice(0, CAP)
      .map((f) =>
        mk("W18", "warning",
          `Packaging junk in the skill: "${f.path}"`,
          "Build artifacts (__pycache__, node_modules, .DS_Store, *.pyc) bloat the package and can leak local machine state.",
          "Delete it and add the pattern to .gitignore so it stays out of the skill folder.",
          { file: f.path })
      );
  },
};

const w19: Rule = {
  id: "W19",
  severity: "warning",
  check(s) {
    const out: Finding[] = [];
    for (const f of s.files) {
      for (const p of SECRET_PATTERNS) {
        if (out.length >= CAP) return out;
        if (p.re.test(f.content)) {
          out.push(
            mk("W19", "warning",
              `Possible ${p.name} in "${f.path}"`,
              "A committed secret in a shared skill leaks credentials to everyone who installs it.",
              "Remove the secret, rotate it immediately, and load credentials from the environment at runtime.",
              { file: f.path })
          );
        }
      }
    }
    return out;
  },
};

export const warningStructureRules: Rule[] = [w10, w11, w17, w18, w19];
