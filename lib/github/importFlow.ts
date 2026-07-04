import type { SkillFile } from "@/lib/skill-lint";
import type { GitHubClient, TreeEntry } from "./client";
import { detectSkills, type DetectedSkillRef } from "./detect";
import { extractRepoLinks, type RepoLink } from "./links";
import { findSkillMd } from "./fetchSkill";
import { miniLint, type MiniLint } from "./miniLint";
import type { ParsedTarget } from "./url";

export const MINI_LINT_CAP = 30;

export interface PickerSkill {
  ref: DetectedSkillRef;
  lint: MiniLint;
  scanned: boolean;
}

export type ImportResult =
  | {
      mode: "picker";
      owner: string;
      repo: string;
      ref: string;
      entries: TreeEntry[];
      skills: PickerSkill[];
      truncated: boolean;
    }
  | { mode: "links"; owner: string; repo: string; links: RepoLink[] }
  | { mode: "gist"; files: SkillFile[]; dirName: string; lint: MiniLint }
  | { mode: "empty"; reason: string };

export async function resolveTarget(
  client: GitHubClient,
  target: ParsedTarget,
  onStep: (step: string) => void = () => {}
): Promise<ImportResult> {
  if (target.kind === "gist") return resolveGist(client, target.gistId, onStep);
  return resolveRepo(client, target, onStep);
}

async function resolveRepo(
  client: GitHubClient,
  target: Extract<ParsedTarget, { kind: "repo" }>,
  onStep: (step: string) => void
): Promise<ImportResult> {
  const { owner, repo, ref, subPath } = target;
  onStep("Reading the repository tree…");
  const tree = await client.getRepoTree(owner, repo, ref);
  const usedRef = ref ?? "HEAD"; // blobs are fetched by sha; ref is only bookkeeping here

  const detection = detectSkills(tree.entries, { repoName: repo, subPath });
  if (detection.mode === "links") {
    onStep("No skills found — scanning the README for linked repos…");
    let readme = "";
    try {
      readme = await client.getReadme(owner, repo);
    } catch {
      readme = "";
    }
    return { mode: "links", owner, repo, links: extractRepoLinks(readme) };
  }

  const skills: PickerSkill[] = [];
  const total = detection.skills.length;
  for (let i = 0; i < total; i++) {
    const skillRef = detection.skills[i];
    if (i >= MINI_LINT_CAP) {
      skills.push({ ref: skillRef, lint: { ok: false, score: 0, errors: 0, warnings: 0, reason: "not scanned" }, scanned: false });
      continue;
    }
    onStep(`Analyzing skill ${i + 1}/${Math.min(total, MINI_LINT_CAP)}: ${skillRef.name}…`);
    const entry = findSkillMd(skillRef, tree.entries);
    let lint: MiniLint;
    if (!entry) {
      lint = { ok: false, score: 0, errors: 0, warnings: 0, reason: "SKILL.md not found" };
    } else {
      try {
        const content = await client.getBlobText(owner, repo, entry.sha);
        lint = miniLint(content, skillRef.name);
      } catch {
        lint = { ok: false, score: 0, errors: 0, warnings: 0, reason: "failed to fetch SKILL.md" };
      }
    }
    skills.push({ ref: skillRef, lint, scanned: true });
  }

  return { mode: "picker", owner, repo, ref: usedRef, entries: tree.entries, skills, truncated: tree.truncated };
}

async function resolveGist(client: GitHubClient, gistId: string, onStep: (step: string) => void): Promise<ImportResult> {
  onStep("Reading the gist…");
  const gistFiles = await client.getGistFiles(gistId);
  const skillEntry = gistFiles.find((f) => /^skill\.md$/i.test(f.filename));
  if (!skillEntry) {
    return { mode: "empty", reason: "This gist has no SKILL.md file." };
  }
  const files: SkillFile[] = gistFiles.map((f) => ({ path: f.filename, content: f.content }));
  return { mode: "gist", files, dirName: gistId, lint: miniLint(skillEntry.content, gistId) };
}
