const API = "https://api.github.com";

export class GitHubError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "GitHubError";
    this.status = status;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class NotFoundError extends GitHubError {
  constructor(message: string) {
    super(404, message);
    this.name = "NotFoundError";
  }
}

export class RateLimitError extends GitHubError {
  readonly resetEpoch: number;
  constructor(resetEpoch: number) {
    super(403, "GitHub API rate limit exceeded");
    this.name = "RateLimitError";
    this.resetEpoch = resetEpoch;
  }
}

export interface TreeEntry {
  path: string;
  mode: string;
  type: "blob" | "tree" | "commit";
  sha: string;
  size?: number;
}
export interface RepoTree {
  entries: TreeEntry[];
  truncated: boolean;
}
export interface GistFile {
  filename: string;
  content: string;
  truncated: boolean;
}

export interface GitHubClient {
  getRepoTree(owner: string, repo: string, ref?: string): Promise<RepoTree>;
  getBlobText(owner: string, repo: string, sha: string): Promise<string>;
  getReadme(owner: string, repo: string): Promise<string>;
  getGistFiles(gistId: string): Promise<GistFile[]>;
}

interface RawTreeEntry {
  path: string;
  mode: string;
  type: TreeEntry["type"];
  sha: string;
  size?: number;
}

/** atob + TextDecoder so multibyte UTF-8 blobs decode correctly. */
export function decodeBase64(b64: string): string {
  const clean = b64.replace(/\s+/g, "");
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder("utf-8").decode(bytes);
}

async function mapError(res: Response): Promise<GitHubError> {
  const remaining = res.headers.get("x-ratelimit-remaining");
  if ((res.status === 403 || res.status === 429) && remaining === "0") {
    return new RateLimitError(Number(res.headers.get("x-ratelimit-reset") ?? "0"));
  }
  if (res.status === 404) {
    return new NotFoundError("repo not found or private — add a token for private repos");
  }
  let message = res.statusText || `HTTP ${res.status}`;
  try {
    const body = (await res.json()) as { message?: unknown };
    if (body && typeof body.message === "string") message = body.message;
  } catch {
    /* non-JSON error body — keep statusText */
  }
  return new GitHubError(res.status, message);
}

export function createClient(opts: { token?: string; fetchFn?: typeof fetch } = {}): GitHubClient {
  const token = opts.token?.trim();
  const doFetch = opts.fetchFn ?? fetch;

  async function getJson<T>(path: string): Promise<T> {
    const headers: Record<string, string> = { Accept: "application/vnd.github+json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await doFetch(`${API}${path}`, { headers });
    if (!res.ok) throw await mapError(res);
    return (await res.json()) as T;
  }

  async function getRepoTree(owner: string, repo: string, ref?: string): Promise<RepoTree> {
    let resolved = ref;
    if (!resolved) {
      const meta = await getJson<{ default_branch: string }>(`/repos/${owner}/${repo}`);
      resolved = meta.default_branch;
    }
    const data = await getJson<{ tree: RawTreeEntry[]; truncated: boolean }>(
      `/repos/${owner}/${repo}/git/trees/${encodeURIComponent(resolved)}?recursive=1`
    );
    return {
      entries: data.tree.map((e) => ({ path: e.path, mode: e.mode, type: e.type, sha: e.sha, size: e.size })),
      truncated: data.truncated === true,
    };
  }

  async function getBlobText(owner: string, repo: string, sha: string): Promise<string> {
    const data = await getJson<{ content: string; encoding: string }>(`/repos/${owner}/${repo}/git/blobs/${sha}`);
    return data.encoding === "base64" ? decodeBase64(data.content) : data.content;
  }

  async function getReadme(owner: string, repo: string): Promise<string> {
    const data = await getJson<{ content: string; encoding: string }>(`/repos/${owner}/${repo}/readme`);
    return data.encoding === "base64" ? decodeBase64(data.content) : data.content;
  }

  async function getGistFiles(gistId: string): Promise<GistFile[]> {
    const data = await getJson<{
      files: Record<string, { filename: string; content: string; truncated: boolean }>;
    }>(`/gists/${gistId}`);
    return Object.values(data.files).map((f) => ({
      filename: f.filename,
      content: f.content,
      truncated: f.truncated === true,
    }));
  }

  return { getRepoTree, getBlobText, getReadme, getGistFiles };
}
