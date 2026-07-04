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
export interface UserRepo {
  owner: string;
  repo: string;
  isPrivate: boolean;
  defaultBranch: string;
  description: string;
}

export interface GitHubClient {
  getRepoTree(owner: string, repo: string, ref?: string): Promise<RepoTree>;
  getBlobText(owner: string, repo: string, sha: string): Promise<string>;
  getReadme(owner: string, repo: string): Promise<string>;
  getGistFiles(gistId: string): Promise<GistFile[]>;
  getUser(): Promise<{ login: string }>;
  listUserRepos(): Promise<UserRepo[]>;
  getDefaultBranch(owner: string, repo: string): Promise<{ defaultBranch: string }>;
  createRepo(opts: { name: string; isPrivate: boolean; description?: string }): Promise<{
    owner: string;
    repo: string;
    defaultBranch: string;
    htmlUrl: string;
  }>;
  getRef(owner: string, repo: string, branch: string): Promise<{ sha: string }>;
  getCommit(owner: string, repo: string, sha: string): Promise<{ treeSha: string }>;
  createBlob(owner: string, repo: string, contentUtf8: string): Promise<{ sha: string }>;
  createTree(
    owner: string,
    repo: string,
    baseTreeSha: string,
    entries: { path: string; sha: string }[]
  ): Promise<{ sha: string }>;
  createCommit(
    owner: string,
    repo: string,
    opts: { message: string; treeSha: string; parentSha: string }
  ): Promise<{ sha: string }>;
  updateRef(owner: string, repo: string, branch: string, commitSha: string): Promise<void>;
}

interface RawTreeEntry {
  path: string;
  mode: string;
  type: TreeEntry["type"];
  sha: string;
  size?: number;
}

/** Encode a ref path (e.g. a branch name) segment-wise so literal slashes in
 *  nested branches like "release/2.0" survive instead of becoming %2F. */
function encodeRefPath(ref: string): string {
  return ref.split("/").map(encodeURIComponent).join("/");
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

  function requireToken(): void {
    if (!token) {
      throw new GitHubError(401, "a token with repo scope is required to publish — add one in the token field");
    }
  }

  async function api<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
    const headers: Record<string, string> = { Accept: "application/vnd.github+json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    if (init?.body !== undefined) headers["Content-Type"] = "application/json";
    const res = await doFetch(`${API}${path}`, {
      method: init?.method ?? "GET",
      headers,
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
    if (!res.ok) throw await mapError(res);
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  // Read helper retained for the existing methods (GET, JSON in).
  function getJson<T>(path: string): Promise<T> {
    return api<T>(path);
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

  async function getUser(): Promise<{ login: string }> {
    requireToken();
    const data = await api<{ login: string }>(`/user`);
    return { login: data.login };
  }

  async function listUserRepos(): Promise<UserRepo[]> {
    requireToken();
    const data = await api<
      { name: string; owner: { login: string }; private: boolean; default_branch: string; description: string | null }[]
    >(`/user/repos?per_page=100&sort=pushed`);
    return data.map((r) => ({
      owner: r.owner.login,
      repo: r.name,
      isPrivate: r.private,
      defaultBranch: r.default_branch,
      description: r.description ?? "",
    }));
  }

  async function getDefaultBranch(owner: string, repo: string): Promise<{ defaultBranch: string }> {
    const data = await api<{ default_branch: string }>(`/repos/${owner}/${repo}`);
    return { defaultBranch: data.default_branch };
  }

  async function createRepo(opts: {
    name: string;
    isPrivate: boolean;
    description?: string;
  }): Promise<{ owner: string; repo: string; defaultBranch: string; htmlUrl: string }> {
    requireToken();
    const data = await api<{
      name: string;
      owner: { login: string };
      default_branch: string;
      html_url: string;
    }>(`/user/repos`, {
      method: "POST",
      body: { name: opts.name, private: opts.isPrivate, description: opts.description, auto_init: true },
    });
    return { owner: data.owner.login, repo: data.name, defaultBranch: data.default_branch, htmlUrl: data.html_url };
  }

  async function getRef(owner: string, repo: string, branch: string): Promise<{ sha: string }> {
    const data = await api<{ object: { sha: string } }>(
      `/repos/${owner}/${repo}/git/ref/heads/${encodeRefPath(branch)}`
    );
    return { sha: data.object.sha };
  }

  async function getCommit(owner: string, repo: string, sha: string): Promise<{ treeSha: string }> {
    const data = await api<{ tree: { sha: string } }>(`/repos/${owner}/${repo}/git/commits/${sha}`);
    return { treeSha: data.tree.sha };
  }

  async function createBlob(owner: string, repo: string, contentUtf8: string): Promise<{ sha: string }> {
    requireToken();
    const data = await api<{ sha: string }>(`/repos/${owner}/${repo}/git/blobs`, {
      method: "POST",
      body: { content: contentUtf8, encoding: "utf-8" },
    });
    return { sha: data.sha };
  }

  async function createTree(
    owner: string,
    repo: string,
    baseTreeSha: string,
    entries: { path: string; sha: string }[]
  ): Promise<{ sha: string }> {
    requireToken();
    const data = await api<{ sha: string }>(`/repos/${owner}/${repo}/git/trees`, {
      method: "POST",
      body: {
        base_tree: baseTreeSha,
        tree: entries.map((e) => ({ path: e.path, mode: "100644", type: "blob", sha: e.sha })),
      },
    });
    return { sha: data.sha };
  }

  async function createCommit(
    owner: string,
    repo: string,
    opts: { message: string; treeSha: string; parentSha: string }
  ): Promise<{ sha: string }> {
    requireToken();
    const data = await api<{ sha: string }>(`/repos/${owner}/${repo}/git/commits`, {
      method: "POST",
      body: { message: opts.message, tree: opts.treeSha, parents: [opts.parentSha] },
    });
    return { sha: data.sha };
  }

  async function updateRef(owner: string, repo: string, branch: string, commitSha: string): Promise<void> {
    requireToken();
    await api(`/repos/${owner}/${repo}/git/refs/heads/${encodeRefPath(branch)}`, {
      method: "PATCH",
      body: { sha: commitSha, force: false },
    });
  }

  return {
    getRepoTree,
    getBlobText,
    getReadme,
    getGistFiles,
    getUser,
    listUserRepos,
    getDefaultBranch,
    createRepo,
    getRef,
    getCommit,
    createBlob,
    createTree,
    createCommit,
    updateRef,
  };
}
