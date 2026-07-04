import type { TreeEntry } from "./client";

export type SkillOrigin = "skills-dir" | "harness-dir" | "category-dir" | "root" | "plugin";

export interface DetectedSkillRef {
  dirPath: string;
  name: string;
  origin: SkillOrigin;
  pluginName?: string;
  viaSymlink: boolean;
}

export type Detection = { mode: "skills"; skills: DetectedSkillRef[] } | { mode: "links" };

export interface DetectOptions {
  repoName?: string;
  subPath?: string;
}

const HARNESS_DIRS = new Set([
  ".claude",
  ".agents",
  ".cursor",
  ".gemini",
  ".github",
  ".opencode",
  ".windsurf",
  ".agent",
]);

const SKILL_MD_RE = /^skill\.md$/i;

function dirname(p: string): string {
  const i = p.lastIndexOf("/");
  return i === -1 ? "" : p.slice(0, i);
}
function basename(p: string): string {
  const i = p.lastIndexOf("/");
  return i === -1 ? p : p.slice(i + 1);
}

function classify(dirPath: string): SkillOrigin {
  if (dirPath === "") return "root";
  const segs = dirPath.split("/");
  for (let i = 0; i < segs.length - 1; i++) {
    if (HARNESS_DIRS.has(segs[i]) && segs[i + 1] === "skills") return "harness-dir";
  }
  const skillsIdx = segs.indexOf("skills");
  if (skillsIdx !== -1) {
    const depthBelow = segs.length - (skillsIdx + 1);
    return depthBelow > 1 ? "category-dir" : "skills-dir";
  }
  // Flat top-level skill folder (e.g. boraoztunc): a plain skill dir.
  return "skills-dir";
}

interface Candidate {
  dirPath: string;
  name: string;
  origin: SkillOrigin;
  pluginName?: string;
  isSymlink: boolean;
  isExact: boolean; // exact "SKILL.md" vs a case variant
}

export function detectSkills(entries: TreeEntry[], opts: DetectOptions = {}): Detection {
  const repoName = opts.repoName ?? "skill";
  const subPath = opts.subPath?.replace(/\/+$/, "");

  // Subpath filter: restrict to entries at or under the subPath.
  const scoped = subPath
    ? entries.filter((e) => e.path === subPath || e.path.startsWith(subPath + "/"))
    : entries;

  // Plugin directories = every dir that contains a plugin.json blob.
  const pluginDirs = scoped
    .filter((e) => e.type === "blob" && basename(e.path) === "plugin.json")
    .map((e) => dirname(e.path));

  function nearestPlugin(dirPath: string): string | undefined {
    let best: string | undefined;
    for (const pd of pluginDirs) {
      const inside = pd === "" || dirPath === pd || dirPath.startsWith(pd + "/");
      if (inside && (best === undefined || pd.length > best.length)) best = pd;
    }
    return best;
  }

  // Gather SKILL.md candidates (exact + case variants).
  const candidates: Candidate[] = [];
  for (const entry of scoped) {
    if (entry.type !== "blob") continue;
    if (!SKILL_MD_RE.test(basename(entry.path))) continue;
    const dirPath = dirname(entry.path);
    const name = dirPath === "" ? repoName : basename(dirPath);
    let origin = classify(dirPath);
    let pluginName: string | undefined;
    const pd = nearestPlugin(dirPath);
    if (pd !== undefined) {
      origin = "plugin";
      pluginName = pd === "" ? repoName : basename(pd);
    }
    candidates.push({
      dirPath,
      name,
      origin,
      pluginName,
      isSymlink: entry.mode === "120000",
      isExact: basename(entry.path) === "SKILL.md",
    });
  }

  if (candidates.length === 0) return { mode: "links" };

  // Group by skill folder name for symlink-mirror dedup.
  const byName = new Map<string, Candidate[]>();
  for (const c of candidates) {
    const arr = byName.get(c.name) ?? [];
    arr.push(c);
    byName.set(c.name, arr);
  }

  const skills: DetectedSkillRef[] = [];
  for (const group of byName.values()) {
    const canonical = group.filter((c) => !c.isSymlink);
    if (canonical.length > 0) {
      // Emit canonical copies, deduped by dirPath, preferring exact SKILL.md over case variants.
      const byDir = new Map<string, Candidate>();
      for (const c of canonical) {
        const prev = byDir.get(c.dirPath);
        if (!prev || (c.isExact && !prev.isExact)) byDir.set(c.dirPath, c);
      }
      for (const c of byDir.values()) skills.push(toRef(c, false));
      // Symlink mirrors of a canonical skill are dropped.
    } else {
      // Reachable only via a symlink alias → keep one, flagged.
      skills.push(toRef(group[0], true));
    }
  }

  // Preserve first-encountered order (Map iteration order mirrors input entries order);
  // a dirPath-alphabetical sort here would reorder category-nested vs. shallow skills
  // in a way that doesn't match the tree's natural traversal order.
  return { mode: "skills", skills };
}

function toRef(c: Candidate, viaSymlink: boolean): DetectedSkillRef {
  const ref: DetectedSkillRef = { dirPath: c.dirPath, name: c.name, origin: c.origin, viaSymlink };
  if (c.pluginName) ref.pluginName = c.pluginName;
  return ref;
}
