import type { SkillFile } from "@/lib/skill-lint";
import type { GitHubClient } from "./client";
import { mapWithConcurrency } from "./fetchSkill";

export type PublishTarget =
  | { mode: "new-repo"; name: string; isPrivate: boolean; description?: string }
  | { mode: "existing"; owner: string; repo: string; branch?: string; pathPrefix?: string };

export interface PublishOptions {
  target: PublishTarget;
  files: SkillFile[];
  dirName: string;
  message: string;
}

export interface PublishResult {
  htmlUrl: string;
  commitSha: string;
  skipped: string[];
}

const BLOB_CONCURRENCY = 4;
const REF_RETRIES = 3;
const REF_RETRY_DELAY_MS = 800;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function normalizePrefix(prefix: string): string {
  return prefix
    .replace(/^\/+/, "")
    .replace(/\/+$/, "")
    .replace(/\/{2,}/g, "/");
}

function joinPath(prefix: string, rel: string): string {
  if (!prefix) return rel;
  return `${prefix}/${rel}`.replace(/\/{2,}/g, "/");
}

/** auto_init's first commit can lag a beat; poll the ref before we build on it. */
async function getRefWithRetry(
  client: GitHubClient,
  owner: string,
  repo: string,
  branch: string
): Promise<{ sha: string }> {
  let lastErr: unknown;
  for (let i = 0; i < REF_RETRIES; i++) {
    try {
      return await client.getRef(owner, repo, branch);
    } catch (e) {
      lastErr = e;
      if (i < REF_RETRIES - 1) await sleep(REF_RETRY_DELAY_MS);
    }
  }
  throw lastErr;
}

export async function publishSkill(client: GitHubClient, opts: PublishOptions): Promise<PublishResult> {
  const { target, files, dirName, message } = opts;

  // Symlink files carry a path target as their content, not real bytes — never publish them.
  const skipped: string[] = [];
  const publishable = files.filter((f) => {
    if (f.symlink) {
      skipped.push(f.path);
      return false;
    }
    return true;
  });

  let owner: string;
  let repo: string;
  let branch: string;
  let htmlUrl: string;
  let pathFor: (f: SkillFile) => string;
  let resolveHead: () => Promise<{ sha: string }>;

  if (target.mode === "new-repo") {
    const created = await client.createRepo({
      name: target.name,
      isPrivate: target.isPrivate,
      description: target.description,
    });
    owner = created.owner;
    repo = created.repo;
    branch = created.defaultBranch;
    htmlUrl = created.htmlUrl;
    pathFor = (f) => f.path; // repo root
    resolveHead = () => getRefWithRetry(client, owner, repo, branch);
  } else {
    owner = target.owner;
    repo = target.repo;
    branch = target.branch?.trim() || (await client.getDefaultBranch(owner, repo)).defaultBranch;
    htmlUrl = `https://github.com/${owner}/${repo}`;
    const prefix = normalizePrefix(target.pathPrefix?.trim() || `skills/${dirName}`);
    pathFor = (f) => joinPath(prefix, f.path);
    resolveHead = () => client.getRef(owner, repo, branch);
  }

  const head = await resolveHead();
  const base = await client.getCommit(owner, repo, head.sha);

  const entries = await mapWithConcurrency(publishable, BLOB_CONCURRENCY, async (f) => {
    const { sha } = await client.createBlob(owner, repo, f.content);
    return { path: pathFor(f), sha };
  });

  const tree = await client.createTree(owner, repo, base.treeSha, entries);
  const commit = await client.createCommit(owner, repo, { message, treeSha: tree.sha, parentSha: head.sha });
  await client.updateRef(owner, repo, branch, commit.sha);

  return { htmlUrl, commitSha: commit.sha, skipped };
}
