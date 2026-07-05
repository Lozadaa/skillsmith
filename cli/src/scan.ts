// Disk -> SkillFile[]. Resolves the two sources (global ~/.claude/skills and the
// project-local ./.claude/skills) plus an optional --path root, finds every
// folder that contains a SKILL.md, and reads its files into the shape the engine
// expects (relative "/"-separated paths, dirName = folder name).
import {
  readdirSync,
  readFileSync,
  statSync,
  lstatSync,
  existsSync,
} from "node:fs";
import { join, relative, sep, basename } from "node:path";
import { homedir } from "node:os";
import type { SkillFile } from "../../lib/skill-lint";

export interface SourceRef {
  id: "global" | "local" | "path";
  label: string;
  root: string;
}

export interface SkillDir {
  dirName: string;
  dir: string;
}

const MAX_FILE_BYTES = 2 * 1024 * 1024; // 2 MB, mirrors the web upload cap

/** The sources that actually exist, in menu order. `pathRoot` overrides both. */
export function resolveSources(cwd = process.cwd(), pathRoot?: string): SourceRef[] {
  if (pathRoot) {
    return existsSync(pathRoot) ? [{ id: "path", label: pathRoot, root: pathRoot }] : [];
  }
  const out: SourceRef[] = [];
  const global = join(homedir(), ".claude", "skills");
  const local = join(cwd, ".claude", "skills");
  if (existsSync(global)) out.push({ id: "global", label: "Global (~/.claude/skills)", root: global });
  if (existsSync(local)) out.push({ id: "local", label: "Project (./.claude/skills)", root: local });
  return out;
}

const hasSkillMd = (dir: string): boolean => {
  try {
    return readdirSync(dir).some((f) => f.toLowerCase() === "skill.md");
  } catch {
    return false;
  }
};

/** Immediate subfolders of `root` that contain a SKILL.md, alphabetical. */
export function listSkillDirs(root: string): SkillDir[] {
  let entries: string[] = [];
  try {
    entries = readdirSync(root);
  } catch {
    return [];
  }
  const dirs: SkillDir[] = [];
  for (const name of entries.sort((a, b) => a.localeCompare(b))) {
    const dir = join(root, name);
    let isDir = false;
    try {
      isDir = statSync(dir).isDirectory();
    } catch {
      continue;
    }
    if (isDir && hasSkillMd(dir)) dirs.push({ dirName: name, dir });
  }
  return dirs;
}

const looksBinary = (buf: Buffer): boolean => {
  const n = Math.min(buf.length, 8000);
  for (let i = 0; i < n; i++) if (buf[i] === 0) return true;
  return false;
};

function walk(root: string, dir: string, acc: SkillFile[]): void {
  let entries: string[] = [];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    const full = join(dir, name);
    let link: ReturnType<typeof lstatSync>;
    try {
      link = lstatSync(full);
    } catch {
      continue;
    }
    const rel = relative(root, full).split(sep).join("/");
    if (link.isSymbolicLink()) {
      acc.push({ path: rel, content: "", symlink: true });
      continue;
    }
    if (link.isDirectory()) {
      walk(root, full, acc);
      continue;
    }
    if (!link.isFile() || link.size > MAX_FILE_BYTES) continue;
    let buf: Buffer;
    try {
      buf = readFileSync(full);
    } catch {
      continue;
    }
    acc.push({ path: rel, content: looksBinary(buf) ? "" : buf.toString("utf8") });
  }
}

/** Read one skill folder into SkillFile[] (relative "/" paths, symlinks flagged). */
export function readSkillFiles(dir: string): SkillFile[] {
  const acc: SkillFile[] = [];
  walk(dir, dir, acc);
  return acc.sort((a, b) => a.path.localeCompare(b.path));
}

export const dirNameOf = (dir: string): string => basename(dir);
