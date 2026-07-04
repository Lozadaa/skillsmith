# Skillsmith Plan 5: GitHub Importer (`/import`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A browser-only GitHub importer at `/import`. The user pastes a repo/gist/`owner/repo` URL; the app talks directly to `api.github.com` (CORS-enabled), detects every skill in the tree across the 7 real-world layouts, shows a picker with a mini-lint score per skill, and hands a chosen skill (with its `references/` and `scripts/`) to the workspace. Repos with no `SKILL.md` fall back to parsing README repo-links ("awesome list" mode). A "collection audit" view scores up to 30 skills at once.

**Architecture:** All GitHub logic lives in `lib/github/` as **pure, fetch-injectable TypeScript** — no React, no Next, no `localStorage`, no `process.env`. Every network call goes through a single `GitHubClient` object created by `createClient({token?, fetchFn?})`; tests inject a mock `fetchFn` returning canned JSON. The UI layer (`app/import/page.tsx` + `components/import/*`) is the only place that reads the token from `localStorage` and passes it to `createClient`. The importer consumes the Plan 1 engine (`lintSkill`) for mini-lint and the Plan 3 handoff (`stashIncomingSkill`) to load a skill into the workspace. Spec: `docs/specs/2026-07-04-skillsmith-design.md` §9 (importer) and §11 (error handling).

**Tech Stack:** Next.js 15 (static export, `output: 'export'`) + React 19 + Tailwind 4, TypeScript strict, Vitest 3 (node env for lib, jsdom env for components), `@testing-library/react`. Built-ins only: `fetch`, `atob`, `TextDecoder`, `TextEncoder`, `Response`, `Headers`. **No new runtime dependencies.**

**Roadmap context:** This is Plan 5 of 5. Plans 1–4 (core engine, W/S rules, workspace UI + export, wizard) are complete. Plan 3 shipped `lib/handoff.ts` and the Vitest+jsdom wiring this plan reuses.

## Global Constraints

- 100% static export — **no server code, no API routes, ever**. Nothing may touch `process.env`, `fs`, or any Next server API. The importer is a client of `api.github.com` from the browser.
- Nothing under `lib/github/` may import React, Next.js, or read `localStorage`/`process.env`. Pure TS. Every network call is injectable via `createClient({fetchFn})`.
- The token is read **only** in the UI layer from `localStorage` key `"skillsmith:gh-pat"` and passed into `createClient`. The lib never sees `localStorage`.
- All `SkillFile.path` values are forward-slash, **relative to the skill folder** (`SKILL.md`, `references/api.md`) — same contract the engine and workspace already use.
- Skill detection is **case-sensitive** on the exact string `SKILL.md`; case-variants (`skill.md`, `Skill.md`) are still importable but the engine's E08 rule warns about them.
- Per-file size cap: skip blobs larger than **2 MB** with a recorded `skipped[]` note (spec §11). Symlink blobs (git mode `120000`) are marked `symlink: true` with the link target as content.
- UI copy in English. Code comments in English.
- Run all commands from repo root `C:\Users\richa\projects\skillsmith`.

## Interfaces consumed (provided by earlier plans — do NOT redefine)

```ts
// lib/skill-lint (Plan 1) — used for mini-lint
import { lintSkill } from "@/lib/skill-lint";
import type { SkillFile } from "@/lib/skill-lint";
// lintSkill(files: SkillFile[], opts?: { profile?: Profile; dirName?: string }): LintOutcome
// SkillFile = { path: string; content: string; symlink?: boolean }
// LintOutcome = { kind: "skill"; skill; findings: Finding[]; score: ScoreResult; tokens }
//             | { kind: "not-a-skill"; reason: string }
// Finding.severity ∈ "error" | "warning" | "suggestion"; ScoreResult = { value: number; band }

// lib/handoff (Plan 3) — used to load a skill into the workspace
import { stashIncomingSkill } from "@/lib/handoff";
// stashIncomingSkill(files: SkillFile[], opts?: { dirName?: string; source?: string }): void
// After calling it, the caller does: router.push("/workspace")

// next/navigation (Next 15) — client router
import { useRouter } from "next/navigation";
```

Vitest+jsdom wiring already exists (Plan 3). Pure `lib/**` tests run in the **node** environment with a mocked `fetchFn`; component tests under `components/**` run in **jsdom** (each component test file starts with `// @vitest-environment jsdom`).

---

### Task 1: `lib/github/url.ts` — GitHub URL/target parser

**Files:**
- Create: `lib/github/url.ts`
- Test: `lib/github/url.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:

```ts
export type ParsedTarget =
  | { kind: "repo"; owner: string; repo: string; ref?: string; subPath?: string }
  | { kind: "gist"; gistId: string };
export function parseGitHubUrl(input: string): ParsedTarget | null;
```

- [ ] **Step 1: Write the failing tests**

`lib/github/url.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { parseGitHubUrl } from "./url";

describe("parseGitHubUrl", () => {
  it("parses a plain repo URL", () => {
    expect(parseGitHubUrl("https://github.com/mattpocock/skills")).toEqual({
      kind: "repo",
      owner: "mattpocock",
      repo: "skills",
    });
  });

  it("parses http, www, and trailing slash", () => {
    expect(parseGitHubUrl("http://www.github.com/o/r/")).toEqual({ kind: "repo", owner: "o", repo: "r" });
  });

  it("strips a trailing .git", () => {
    expect(parseGitHubUrl("https://github.com/o/r.git")).toEqual({ kind: "repo", owner: "o", repo: "r" });
  });

  it("parses a bare owner/repo shorthand", () => {
    expect(parseGitHubUrl("facebook/react")).toEqual({ kind: "repo", owner: "facebook", repo: "react" });
  });

  it("parses tree URLs with ref and subPath", () => {
    expect(parseGitHubUrl("https://github.com/o/r/tree/main/skills/foo")).toEqual({
      kind: "repo",
      owner: "o",
      repo: "r",
      ref: "main",
      subPath: "skills/foo",
    });
  });

  it("parses tree URLs with ref but no subPath", () => {
    expect(parseGitHubUrl("https://github.com/o/r/tree/develop")).toEqual({
      kind: "repo",
      owner: "o",
      repo: "r",
      ref: "develop",
    });
  });

  it("parses blob URLs (ref + file path as subPath)", () => {
    expect(parseGitHubUrl("https://github.com/o/r/blob/main/skills/foo/SKILL.md")).toEqual({
      kind: "repo",
      owner: "o",
      repo: "r",
      ref: "main",
      subPath: "skills/foo/SKILL.md",
    });
  });

  it("ignores unknown trailing paths and resolves the repo root", () => {
    expect(parseGitHubUrl("https://github.com/o/r/issues/42")).toEqual({ kind: "repo", owner: "o", repo: "r" });
  });

  it("drops query strings and fragments", () => {
    expect(parseGitHubUrl("https://github.com/o/r?tab=readme#top")).toEqual({ kind: "repo", owner: "o", repo: "r" });
  });

  it("parses gist URLs with a user segment", () => {
    expect(parseGitHubUrl("https://gist.github.com/someone/abc123def456")).toEqual({
      kind: "gist",
      gistId: "abc123def456",
    });
  });

  it("parses gist URLs without a user segment", () => {
    expect(parseGitHubUrl("gist.github.com/abc123")).toEqual({ kind: "gist", gistId: "abc123" });
  });

  it("returns null for empty, host-only, single-segment, and non-github hosts", () => {
    expect(parseGitHubUrl("")).toBeNull();
    expect(parseGitHubUrl("   ")).toBeNull();
    expect(parseGitHubUrl("https://github.com")).toBeNull();
    expect(parseGitHubUrl("react")).toBeNull();
    expect(parseGitHubUrl("https://example.com/o/r")).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/github/url.test.ts`
Expected: FAIL — "Cannot find module './url'".

- [ ] **Step 3: Implement url.ts**

```ts
export type ParsedTarget =
  | { kind: "repo"; owner: string; repo: string; ref?: string; subPath?: string }
  | { kind: "gist"; gistId: string };

const GIST_HOST = "gist.github.com";

/**
 * Parses a GitHub repo, gist, tree/blob, or bare `owner/repo` reference.
 * Ref is treated as a single path segment (branch names with slashes are not
 * disambiguable from a URL alone; this matches how github.com renders them).
 */
export function parseGitHubUrl(input: string): ParsedTarget | null {
  if (!input) return null;
  let s = input.trim();
  if (s === "") return null;

  // Strip a git+ prefix and any scheme://, then a leading www.
  s = s.replace(/^git\+/i, "").replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//, "");
  s = s.replace(/^www\./i, "");
  // Drop fragment then query.
  s = s.split("#")[0].split("?")[0];
  // Collapse trailing slashes.
  s = s.replace(/\/+$/, "");

  // Split host from path. A first segment containing a dot is treated as a host.
  let host = "";
  let path = s;
  const firstSlash = s.indexOf("/");
  const firstSeg = firstSlash === -1 ? s : s.slice(0, firstSlash);
  if (firstSeg.includes(".")) {
    host = firstSeg.toLowerCase();
    path = firstSlash === -1 ? "" : s.slice(firstSlash + 1);
  }

  const segments = path.split("/").filter(Boolean);

  if (host === GIST_HOST) {
    const gistId = segments[segments.length - 1];
    if (!gistId) return null;
    return { kind: "gist", gistId: stripGit(gistId) };
  }

  // github.com host, or bare `owner/repo` shorthand (no host).
  if (host === "" || host === "github.com") {
    if (segments.length < 2) return null;
    const owner = segments[0];
    const repo = stripGit(segments[1]);
    if (!owner || !repo) return null;
    const rest = segments.slice(2);
    if (rest.length >= 2 && (rest[0] === "tree" || rest[0] === "blob")) {
      const ref = rest[1];
      const subPath = rest.slice(2).join("/") || undefined;
      return subPath ? { kind: "repo", owner, repo, ref, subPath } : { kind: "repo", owner, repo, ref };
    }
    // Unknown trailing path (issues, pulls, wiki, …) → resolve the repo root.
    return { kind: "repo", owner, repo };
  }

  return null;
}

function stripGit(s: string): string {
  return s.replace(/\.git$/i, "");
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/github/url.test.ts`
Expected: PASS (13 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/github/url.ts lib/github/url.test.ts
git commit -m "feat(import): GitHub URL/target parser"
```

---

### Task 2: `lib/github/client.ts` — GitHubClient (errors, auth, base64)

**Files:**
- Create: `lib/github/client.ts`
- Test: `lib/github/client.test.ts`

**Interfaces:**
- Consumes: nothing (built-ins `atob`, `TextDecoder`, `Response`, `Headers`)
- Produces:

```ts
export class GitHubError extends Error { readonly status: number; }
export class NotFoundError extends GitHubError {}
export class RateLimitError extends GitHubError { readonly resetEpoch: number; }

export interface TreeEntry { path: string; mode: string; type: "blob" | "tree" | "commit"; sha: string; size?: number; }
export interface RepoTree { entries: TreeEntry[]; truncated: boolean; }
export interface GistFile { filename: string; content: string; truncated: boolean; }

export interface GitHubClient {
  getRepoTree(owner: string, repo: string, ref?: string): Promise<RepoTree>;
  getBlobText(owner: string, repo: string, sha: string): Promise<string>;
  getReadme(owner: string, repo: string): Promise<string>;
  getGistFiles(gistId: string): Promise<GistFile[]>;
}

export function createClient(opts?: { token?: string; fetchFn?: typeof fetch }): GitHubClient;
export function decodeBase64(b64: string): string;
```

- [ ] **Step 1: Write the failing tests**

`lib/github/client.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { createClient, decodeBase64, GitHubError, NotFoundError, RateLimitError } from "./client";

/** Build a mock fetch from a path→response map. Missing paths yield a 404. */
function mockFetch(
  routes: Record<string, { status?: number; body?: unknown; headers?: Record<string, string> }>
): typeof fetch {
  return (async (url: string | URL) => {
    const path = String(url).replace("https://api.github.com", "");
    const r = routes[path];
    if (!r) {
      return new Response(JSON.stringify({ message: "Not Found" }), {
        status: 404,
        headers: { "content-type": "application/json", "x-ratelimit-remaining": "59" },
      });
    }
    return new Response(r.body === undefined ? "" : JSON.stringify(r.body), {
      status: r.status ?? 200,
      headers: { "content-type": "application/json", ...(r.headers ?? {}) },
    });
  }) as unknown as typeof fetch;
}

const b64 = (s: string) => Buffer.from(s, "utf-8").toString("base64");

describe("decodeBase64", () => {
  it("decodes UTF-8 including multibyte characters and ignores newlines", () => {
    const wrapped = b64("研究深度 — café").replace(/(.{4})/g, "$1\n");
    expect(decodeBase64(wrapped)).toBe("研究深度 — café");
  });
});

describe("getRepoTree", () => {
  it("resolves the default branch then fetches the recursive tree", async () => {
    const fetchFn = mockFetch({
      "/repos/o/r": { body: { default_branch: "main" } },
      "/repos/o/r/git/trees/main?recursive=1": {
        body: {
          truncated: false,
          tree: [
            { path: "SKILL.md", mode: "100644", type: "blob", sha: "s1", size: 12 },
            { path: "skills", mode: "040000", type: "tree", sha: "t1" },
          ],
        },
      },
    });
    const client = createClient({ fetchFn });
    const tree = await client.getRepoTree("o", "r");
    expect(tree.truncated).toBe(false);
    expect(tree.entries[0]).toEqual({ path: "SKILL.md", mode: "100644", type: "blob", sha: "s1", size: 12 });
  });

  it("passes an explicit ref through and reports truncation", async () => {
    const fetchFn = mockFetch({
      "/repos/o/r/git/trees/dev?recursive=1": { body: { truncated: true, tree: [] } },
    });
    const tree = await createClient({ fetchFn }).getRepoTree("o", "r", "dev");
    expect(tree.truncated).toBe(true);
    expect(tree.entries).toEqual([]);
  });
});

describe("auth header", () => {
  it("sends Bearer token and Accept header when a token is present", async () => {
    let seen: Headers | undefined;
    const fetchFn = (async (_url: string, init?: RequestInit) => {
      seen = new Headers(init?.headers);
      return new Response(JSON.stringify({ default_branch: "main" }), { status: 200 });
    }) as unknown as typeof fetch;
    await createClient({ token: "ghp_secret", fetchFn }).getRepoTree("o", "r", "main").catch(() => {});
    expect(seen?.get("authorization")).toBe("Bearer ghp_secret");
    expect(seen?.get("accept")).toBe("application/vnd.github+json");
  });

  it("omits the Authorization header when no token is set", async () => {
    let seen: Headers | undefined;
    const fetchFn = (async (_url: string, init?: RequestInit) => {
      seen = new Headers(init?.headers);
      return new Response(JSON.stringify({ truncated: false, tree: [] }), { status: 200 });
    }) as unknown as typeof fetch;
    await createClient({ fetchFn }).getRepoTree("o", "r", "main");
    expect(seen?.has("authorization")).toBe(false);
  });
});

describe("getBlobText / getReadme / getGistFiles", () => {
  it("base64-decodes a blob", async () => {
    const fetchFn = mockFetch({
      "/repos/o/r/git/blobs/sha1": { body: { encoding: "base64", content: b64("hello ünïcode") } },
    });
    expect(await createClient({ fetchFn }).getBlobText("o", "r", "sha1")).toBe("hello ünïcode");
  });

  it("decodes the README", async () => {
    const fetchFn = mockFetch({
      "/repos/o/r/readme": { body: { encoding: "base64", content: b64("# Title\n[a](https://github.com/x/y)") } },
    });
    expect(await createClient({ fetchFn }).getReadme("o", "r")).toContain("github.com/x/y");
  });

  it("returns gist files as an array", async () => {
    const fetchFn = mockFetch({
      "/gists/g1": {
        body: { files: { "SKILL.md": { filename: "SKILL.md", content: "---\nname: g\n---\nx", truncated: false } } },
      },
    });
    const files = await createClient({ fetchFn }).getGistFiles("g1");
    expect(files).toEqual([{ filename: "SKILL.md", content: "---\nname: g\n---\nx", truncated: false }]);
  });
});

describe("error mapping", () => {
  it("maps 404 to NotFoundError with a private-repo hint", async () => {
    const fetchFn = mockFetch({});
    await expect(createClient({ fetchFn }).getRepoTree("o", "missing", "main")).rejects.toBeInstanceOf(NotFoundError);
    await createClient({ fetchFn })
      .getRepoTree("o", "missing", "main")
      .catch((e: NotFoundError) => expect(e.message).toMatch(/private repos/i));
  });

  it("maps 403 + x-ratelimit-remaining:0 to RateLimitError with reset epoch", async () => {
    const fetchFn = mockFetch({
      "/repos/o/r/git/trees/main?recursive=1": {
        status: 403,
        body: { message: "rate limited" },
        headers: { "x-ratelimit-remaining": "0", "x-ratelimit-reset": "1893456000" },
      },
    });
    await createClient({ fetchFn })
      .getRepoTree("o", "r", "main")
      .catch((e: unknown) => {
        expect(e).toBeInstanceOf(RateLimitError);
        expect((e as RateLimitError).resetEpoch).toBe(1893456000);
      });
  });

  it("maps other statuses to GitHubError carrying the API message", async () => {
    const fetchFn = mockFetch({
      "/repos/o/r/git/trees/main?recursive=1": { status: 500, body: { message: "server boom" } },
    });
    await createClient({ fetchFn })
      .getRepoTree("o", "r", "main")
      .catch((e: unknown) => {
        expect(e).toBeInstanceOf(GitHubError);
        expect((e as GitHubError).status).toBe(500);
        expect((e as GitHubError).message).toBe("server boom");
      });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/github/client.test.ts`
Expected: FAIL — "Cannot find module './client'".

- [ ] **Step 3: Implement client.ts**

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/github/client.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add lib/github/client.ts lib/github/client.test.ts
git commit -m "feat(import): GitHubClient with typed errors, auth, base64 decode"
```

---

### Task 3: `lib/github/detect.ts` — skill detection across the 6 real layouts

**Files:**
- Create: `lib/github/detect.ts`
- Test: `lib/github/detect.test.ts`

**Interfaces:**
- Consumes: `TreeEntry` from `./client`
- Produces:

```ts
export type SkillOrigin = "skills-dir" | "harness-dir" | "category-dir" | "root" | "plugin";
export interface DetectedSkillRef {
  dirPath: string;      // "" for a repo-root single skill
  name: string;         // basename of the skill dir (or repo name for a root skill)
  origin: SkillOrigin;
  pluginName?: string;
  viaSymlink: boolean;
}
export type Detection =
  | { mode: "skills"; skills: DetectedSkillRef[] }
  | { mode: "links" };
export interface DetectOptions { repoName?: string; subPath?: string }
export function detectSkills(entries: TreeEntry[], opts?: DetectOptions): Detection;
```

**Symlink dedup semantics (entries-only, no blob reads):** git returns each symlink as a `mode:"120000"` blob whose content (the link target) is NOT in the tree listing, and git does not recurse into symlinked directories — so an aliased directory contributes no child `SKILL.md`. Rule: a `SKILL.md` whose entry mode is `120000` is an alias file. Group candidate skills by folder `name`; if a canonical (non-symlink) copy exists in the group, emit the canonical copies (deduped by `dirPath`) and drop symlink mirrors; if a skill is reachable **only** via a symlink alias, emit one ref with `viaSymlink: true`. Genuinely-distinct canonical skills that happen to share a folder name survive because they have different `dirPath`s; only symlink copies are collapsed.

- [ ] **Step 1: Write the failing tests** (covers spec §9 layouts 1–5, 7 + truncated marker)

`lib/github/detect.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { detectSkills } from "./detect";
import type { TreeEntry } from "./client";

/** Minimal tree-entry builder. mode defaults to a regular file. */
function e(path: string, mode = "100644", type: TreeEntry["type"] = "blob"): TreeEntry {
  return { path, mode, type, sha: "sha-" + path };
}

describe("layout (b): boraoztunc flat root dirs", () => {
  it("detects one skill per top-level directory as skills-dir", () => {
    const d = detectSkills(
      [e("adversarial-review/SKILL.md"), e("adversarial-review/reference.md"), e("code-golf/SKILL.md")],
      { repoName: "skills" }
    );
    expect(d.mode).toBe("skills");
    if (d.mode !== "skills") return;
    expect(d.skills.map((s) => [s.name, s.origin, s.dirPath])).toEqual([
      ["adversarial-review", "skills-dir", "adversarial-review"],
      ["code-golf", "skills-dir", "code-golf"],
    ]);
  });
});

describe("layout (a): jezweb marketplace with plugin.json under plugin dirs", () => {
  it("attributes skills to their nearest plugin.json directory", () => {
    const d = detectSkills(
      [
        e(".claude-plugin/marketplace.json"),
        e("plugins/seo-pack/plugin.json"),
        e("plugins/seo-pack/skills/meta-tags/SKILL.md"),
        e("plugins/seo-pack/skills/sitemaps/SKILL.md"),
      ],
      { repoName: "marketplace" }
    );
    if (d.mode !== "skills") throw new Error("expected skills");
    expect(d.skills.map((s) => [s.name, s.origin, s.pluginName])).toEqual([
      ["meta-tags", "plugin", "seo-pack"],
      ["sitemaps", "plugin", "seo-pack"],
    ]);
  });
});

describe("layout (c): mattpocock skills/<category>/<name>", () => {
  it("classifies deep skills/ nesting as category-dir and shallow as skills-dir", () => {
    const d = detectSkills(
      [e("skills/testing/vitest-setup/SKILL.md"), e("skills/formatting/SKILL.md")],
      { repoName: "skills" }
    );
    if (d.mode !== "skills") throw new Error("expected skills");
    expect(d.skills.map((s) => [s.name, s.origin])).toEqual([
      ["vitest-setup", "category-dir"],
      ["formatting", "skills-dir"],
    ]);
  });

  it("classifies harness dirs as harness-dir", () => {
    const d = detectSkills([e(".cursor/skills/foo/SKILL.md"), e(".github/skills/bar/SKILL.md")]);
    if (d.mode !== "skills") throw new Error("expected skills");
    expect(d.skills.map((s) => s.origin)).toEqual(["harness-dir", "harness-dir"]);
  });
});

describe("layout (d): monorepo with .codex symlink aliases (mode 120000)", () => {
  it("keeps the canonical skill and drops the symlink mirror", () => {
    const d = detectSkills([
      e(".claude/skills/git-helper/SKILL.md"),
      e(".claude/skills/git-helper/reference.md"),
      e(".codex/skills/git-helper/SKILL.md", "120000"), // file-level alias of the canonical SKILL.md
    ]);
    if (d.mode !== "skills") throw new Error("expected skills");
    expect(d.skills).toHaveLength(1);
    expect(d.skills[0]).toMatchObject({ name: "git-helper", origin: "harness-dir", viaSymlink: false });
  });

  it("flags a skill reachable only via a symlink alias", () => {
    const d = detectSkills([e(".codex/skills/orphan/SKILL.md", "120000")]);
    if (d.mode !== "skills") throw new Error("expected skills");
    expect(d.skills[0]).toMatchObject({ name: "orphan", viaSymlink: true });
  });
});

describe("layout root single skill", () => {
  it("uses the repo name and origin root", () => {
    const d = detectSkills([e("SKILL.md"), e("references/api.md")], { repoName: "my-skill" });
    if (d.mode !== "skills") throw new Error("expected skills");
    expect(d.skills[0]).toMatchObject({ dirPath: "", name: "my-skill", origin: "root", viaSymlink: false });
  });
});

describe("layout case variants", () => {
  it("imports skill.md variants and prefers exact SKILL.md when both exist in a dir", () => {
    const variant = detectSkills([e("foo/skill.md")]);
    if (variant.mode !== "skills") throw new Error("expected skills");
    expect(variant.skills).toHaveLength(1);
    expect(variant.skills[0].name).toBe("foo");

    const both = detectSkills([e("bar/SKILL.md"), e("bar/skill.md")]);
    if (both.mode !== "skills") throw new Error("expected skills");
    expect(both.skills).toHaveLength(1);
    expect(both.skills[0].dirPath).toBe("bar");
  });
});

describe("layout (e): awesome-list repo with zero SKILL.md", () => {
  it("returns links mode so the caller parses the README", () => {
    const d = detectSkills([e("README.md"), e("CONTRIBUTING.md"), e("LICENSE")], { repoName: "awesome-skills" });
    expect(d.mode).toBe("links");
  });
});

describe("layout (f): truncated tree still detects what is present", () => {
  it("detects skills from a partial (truncated) entry list", () => {
    // Truncation is a client-level flag; detect operates on whatever entries arrived.
    const d = detectSkills([e("skills/one/SKILL.md")], { repoName: "big" });
    if (d.mode !== "skills") throw new Error("expected skills");
    expect(d.skills).toHaveLength(1);
  });
});

describe("layout 5: subPath filter (direct /tree/main/skills/foo URL)", () => {
  it("restricts detection to entries under subPath", () => {
    const d = detectSkills(
      [e("skills/foo/SKILL.md"), e("skills/bar/SKILL.md")],
      { repoName: "r", subPath: "skills/foo" }
    );
    if (d.mode !== "skills") throw new Error("expected skills");
    expect(d.skills.map((s) => s.name)).toEqual(["foo"]);
  });

  it("supports a subPath that points directly at a SKILL.md (blob URL)", () => {
    const d = detectSkills(
      [e("skills/foo/SKILL.md"), e("skills/bar/SKILL.md")],
      { repoName: "r", subPath: "skills/foo/SKILL.md" }
    );
    if (d.mode !== "skills") throw new Error("expected skills");
    expect(d.skills.map((s) => s.name)).toEqual(["foo"]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/github/detect.test.ts`
Expected: FAIL — "Cannot find module './detect'".

- [ ] **Step 3: Implement detect.ts**

```ts
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

  // Stable output order: by dirPath then name.
  skills.sort((a, b) => a.dirPath.localeCompare(b.dirPath) || a.name.localeCompare(b.name));
  return { mode: "skills", skills };
}

function toRef(c: Candidate, viaSymlink: boolean): DetectedSkillRef {
  const ref: DetectedSkillRef = { dirPath: c.dirPath, name: c.name, origin: c.origin, viaSymlink };
  if (c.pluginName) ref.pluginName = c.pluginName;
  return ref;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/github/detect.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add lib/github/detect.ts lib/github/detect.test.ts
git commit -m "feat(import): skill detection across marketplace/flat/category/harness/symlink layouts"
```

---

### Task 4: `lib/github/fetchSkill.ts` + `lib/github/links.ts`

**Files:**
- Create: `lib/github/fetchSkill.ts`
- Create: `lib/github/links.ts`
- Test: `lib/github/fetchSkill.test.ts`
- Test: `lib/github/links.test.ts`

**Interfaces:**
- Consumes: `GitHubClient`, `TreeEntry` from `./client`; `DetectedSkillRef` from `./detect`; `parseGitHubUrl` from `./url`; `SkillFile` from `@/lib/skill-lint`
- Produces:

```ts
// fetchSkill.ts
export interface FetchedSkill {
  files: SkillFile[];
  dirName: string;
  skipped: { path: string; reason: string }[];
}
export function findSkillMd(skill: DetectedSkillRef, entries: TreeEntry[]): TreeEntry | undefined;
export function fetchSkillFiles(
  client: GitHubClient, owner: string, repo: string, ref: string,
  skill: DetectedSkillRef, entries: TreeEntry[]
): Promise<FetchedSkill>;

// links.ts
export interface RepoLink { owner: string; repo: string; label: string }
export function extractRepoLinks(readmeMarkdown: string): RepoLink[];
```

- [ ] **Step 1: Write the failing tests**

`lib/github/fetchSkill.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { fetchSkillFiles, findSkillMd } from "./fetchSkill";
import type { GitHubClient, TreeEntry } from "./client";
import type { DetectedSkillRef } from "./detect";

function entry(path: string, sha: string, mode = "100644", size = 10): TreeEntry {
  return { path, mode, type: "blob", sha, size };
}

/** Mock client whose getBlobText returns "blob:<sha>" (or the symlink target). */
function mockClient(overrides: Partial<GitHubClient> = {}): GitHubClient {
  return {
    getRepoTree: async () => ({ entries: [], truncated: false }),
    getBlobText: async (_o, _r, sha) => `blob:${sha}`,
    getReadme: async () => "",
    getGistFiles: async () => [],
    ...overrides,
  };
}

describe("findSkillMd", () => {
  it("finds the exact SKILL.md for a dir skill", () => {
    const entries = [entry("skills/foo/SKILL.md", "s1"), entry("skills/foo/reference.md", "s2")];
    const skill: DetectedSkillRef = { dirPath: "skills/foo", name: "foo", origin: "skills-dir", viaSymlink: false };
    expect(findSkillMd(skill, entries)?.sha).toBe("s1");
  });

  it("finds a root SKILL.md", () => {
    const entries = [entry("SKILL.md", "root")];
    const skill: DetectedSkillRef = { dirPath: "", name: "r", origin: "root", viaSymlink: false };
    expect(findSkillMd(skill, entries)?.sha).toBe("root");
  });
});

describe("fetchSkillFiles", () => {
  it("gathers every blob under the skill dir with relative forward-slash paths", async () => {
    const entries = [
      entry("skills/foo/SKILL.md", "s1"),
      entry("skills/foo/references/api.md", "s2"),
      entry("skills/foo/scripts/run.py", "s3"),
      entry("skills/other/SKILL.md", "s9"), // excluded — different skill
    ];
    const skill: DetectedSkillRef = { dirPath: "skills/foo", name: "foo", origin: "skills-dir", viaSymlink: false };
    const out = await fetchSkillFiles(mockClient(), "o", "r", "main", skill, entries);
    expect(out.dirName).toBe("foo");
    expect(out.files.map((f) => f.path).sort()).toEqual(["SKILL.md", "references/api.md", "scripts/run.py"]);
    expect(out.files.find((f) => f.path === "SKILL.md")?.content).toBe("blob:s1");
    expect(out.skipped).toEqual([]);
  });

  it("fetches only SKILL.md for a root single-file skill", async () => {
    const entries = [entry("SKILL.md", "root"), entry("README.md", "readme")];
    const skill: DetectedSkillRef = { dirPath: "", name: "my-skill", origin: "root", viaSymlink: false };
    const out = await fetchSkillFiles(mockClient(), "o", "r", "main", skill, entries);
    expect(out.files.map((f) => f.path)).toEqual(["SKILL.md"]);
    expect(out.dirName).toBe("my-skill");
  });

  it("skips files larger than 2 MB with a note and does not fetch them", async () => {
    let fetched = 0;
    const client = mockClient({
      getBlobText: async (_o, _r, sha) => {
        fetched++;
        return `blob:${sha}`;
      },
    });
    const entries = [
      entry("skills/foo/SKILL.md", "s1", "100644", 10),
      entry("skills/foo/big.bin", "s2", "100644", 3_000_000),
    ];
    const skill: DetectedSkillRef = { dirPath: "skills/foo", name: "foo", origin: "skills-dir", viaSymlink: false };
    const out = await fetchSkillFiles(client, "o", "r", "main", skill, entries);
    expect(out.files.map((f) => f.path)).toEqual(["SKILL.md"]);
    expect(out.skipped).toEqual([{ path: "big.bin", reason: expect.stringMatching(/2 MB/i) }]);
    expect(fetched).toBe(1);
  });

  it("marks mode-120000 blobs as symlinks with the target as content", async () => {
    const client = mockClient({ getBlobText: async () => "../shared/reference.md" });
    const entries = [
      entry("skills/foo/SKILL.md", "s1"),
      entry("skills/foo/link.md", "s2", "120000", 20),
    ];
    const skill: DetectedSkillRef = { dirPath: "skills/foo", name: "foo", origin: "skills-dir", viaSymlink: false };
    const out = await fetchSkillFiles(client, "o", "r", "main", skill, entries);
    const link = out.files.find((f) => f.path === "link.md");
    expect(link).toMatchObject({ symlink: true, content: "../shared/reference.md" });
  });
});
```

`lib/github/links.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { extractRepoLinks } from "./links";

describe("extractRepoLinks", () => {
  it("extracts github repo links, dedupes, and keeps labels", () => {
    const md = `# Awesome Skills
- [PDF tools](https://github.com/anthropics/skills) — official
- [again](https://github.com/anthropics/skills)
- [cursor pack](https://github.com/other/pack/tree/main/skills)`;
    expect(extractRepoLinks(md)).toEqual([
      { owner: "anthropics", repo: "skills", label: "PDF tools" },
      { owner: "other", repo: "pack", label: "cursor pack" },
    ]);
  });

  it("ignores images, anchors, and non-github links", () => {
    const md = `![logo](https://github.com/x/y/raw/main/logo.png)
[jump](#section)
[docs](https://example.com/a/b)`;
    expect(extractRepoLinks(md)).toEqual([]);
  });

  it("caps the result at 100 links", () => {
    const md = Array.from({ length: 150 }, (_, i) => `[r${i}](https://github.com/o/repo${i})`).join("\n");
    expect(extractRepoLinks(md)).toHaveLength(100);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/github/fetchSkill.test.ts lib/github/links.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement links.ts**

```ts
import { parseGitHubUrl } from "./url";

export interface RepoLink {
  owner: string;
  repo: string;
  label: string;
}

// [label](url "optional title") — capture the leading "!" so images can be skipped.
const LINK_RE = /(!?)\[([^\]]*)\]\(\s*([^)\s]+)(?:\s+"[^"]*")?\s*\)/g;

export function extractRepoLinks(readmeMarkdown: string): RepoLink[] {
  const out: RepoLink[] = [];
  const seen = new Set<string>();
  for (const m of readmeMarkdown.matchAll(LINK_RE)) {
    if (m[1] === "!") continue; // image
    const label = m[2].trim();
    const url = m[3];
    if (url.startsWith("#")) continue; // anchor
    if (!/github\.com/i.test(url)) continue; // github only (avoids relative-path false positives)
    const parsed = parseGitHubUrl(url);
    if (!parsed || parsed.kind !== "repo") continue;
    const key = `${parsed.owner}/${parsed.repo}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ owner: parsed.owner, repo: parsed.repo, label: label || key });
    if (out.length >= 100) break;
  }
  return out;
}
```

- [ ] **Step 4: Implement fetchSkill.ts**

```ts
import type { SkillFile } from "@/lib/skill-lint";
import type { GitHubClient, TreeEntry } from "./client";
import type { DetectedSkillRef } from "./detect";

export interface FetchedSkill {
  files: SkillFile[];
  dirName: string;
  skipped: { path: string; reason: string }[];
}

const MAX_BYTES = 2 * 1024 * 1024;
const CONCURRENCY = 4;

function basename(p: string): string {
  const i = p.lastIndexOf("/");
  return i === -1 ? p : p.slice(i + 1);
}

export function findSkillMd(skill: DetectedSkillRef, entries: TreeEntry[]): TreeEntry | undefined {
  const target = skill.dirPath === "" ? "SKILL.md" : `${skill.dirPath}/SKILL.md`;
  const exact = entries.find((e) => e.type === "blob" && e.path === target);
  if (exact) return exact;
  // Fall back to a case variant in the same directory.
  return entries.find(
    (e) =>
      e.type === "blob" &&
      /^skill\.md$/i.test(basename(e.path)) &&
      e.path.slice(0, Math.max(0, e.path.lastIndexOf("/"))) === skill.dirPath
  );
}

/** Run an async mapper over items with a bounded number of workers, preserving order. */
async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker(): Promise<void> {
    while (next < items.length) {
      const idx = next++;
      results[idx] = await fn(items[idx]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

export async function fetchSkillFiles(
  client: GitHubClient,
  owner: string,
  repo: string,
  ref: string,
  skill: DetectedSkillRef,
  entries: TreeEntry[]
): Promise<FetchedSkill> {
  void ref; // blobs are addressed by sha; ref is retained for API symmetry.
  const dirName = skill.dirPath === "" ? skill.name : basename(skill.dirPath);

  // Which blobs belong to this skill.
  let blobs: TreeEntry[];
  if (skill.dirPath === "") {
    const skillMd = findSkillMd(skill, entries);
    blobs = skillMd ? [skillMd] : [];
  } else {
    const prefix = skill.dirPath + "/";
    blobs = entries.filter((e) => e.type === "blob" && e.path.startsWith(prefix));
  }

  const skipped: { path: string; reason: string }[] = [];
  const relOf = (e: TreeEntry) => (skill.dirPath === "" ? e.path : e.path.slice(skill.dirPath.length + 1));

  const toFetch = blobs.filter((e) => {
    if (typeof e.size === "number" && e.size > MAX_BYTES) {
      skipped.push({ path: relOf(e), reason: `File is over 2 MB (${e.size} bytes) — skipped` });
      return false;
    }
    return true;
  });

  const files = await mapWithConcurrency(toFetch, CONCURRENCY, async (e): Promise<SkillFile> => {
    const content = await client.getBlobText(owner, repo, e.sha);
    const path = relOf(e);
    return e.mode === "120000" ? { path, content, symlink: true } : { path, content };
  });

  return { files, dirName, skipped };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run lib/github/fetchSkill.test.ts lib/github/links.test.ts`
Expected: PASS (all tests).

- [ ] **Step 6: Commit**

```bash
git add lib/github/fetchSkill.ts lib/github/links.ts lib/github/fetchSkill.test.ts lib/github/links.test.ts
git commit -m "feat(import): blob gathering (size cap, symlinks) and README repo-link extraction"
```

---

### Task 5: Import page UI — resolve flow, picker, links, error states, mini-lint

**Files:**
- Create: `lib/github/miniLint.ts`
- Create: `lib/github/importFlow.ts`
- Test: `lib/github/importFlow.test.ts`
- Create: `app/import/page.tsx`
- Create: `components/import/ImportApp.tsx`
- Create: `components/import/TokenField.tsx`
- Create: `components/import/SkillPicker.tsx`
- Create: `components/import/LinksList.tsx`
- Create: `components/import/ErrorPanel.tsx`
- Test: `components/import/ImportApp.test.tsx`
- Edit (ensure): `vitest.config.ts`

**Interfaces:**
- Consumes: everything from `lib/github/*`, `lintSkill`/`SkillFile` from `@/lib/skill-lint`, `stashIncomingSkill` from `@/lib/handoff`, `useRouter` from `next/navigation`
- Produces:

```ts
// miniLint.ts
export interface MiniLint { ok: boolean; score: number; errors: number; warnings: number; reason?: string }
export function miniLint(skillMd: string, dirName?: string): MiniLint;

// importFlow.ts
export interface PickerSkill { ref: DetectedSkillRef; lint: MiniLint; scanned: boolean }
export type ImportResult =
  | { mode: "picker"; owner: string; repo: string; ref: string; entries: TreeEntry[]; skills: PickerSkill[]; truncated: boolean }
  | { mode: "links"; owner: string; repo: string; links: RepoLink[] }
  | { mode: "gist"; files: SkillFile[]; dirName: string; lint: MiniLint }
  | { mode: "empty"; reason: string };
export const MINI_LINT_CAP = 30;
export function resolveTarget(client: GitHubClient, target: ParsedTarget, onStep?: (step: string) => void): Promise<ImportResult>;
```

- [ ] **Step 1: Write the failing tests (flow + component smoke)**

`lib/github/importFlow.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { resolveTarget } from "./importFlow";
import type { GitHubClient } from "./client";

const SKILL_MD = (name: string) => `---\nname: ${name}\ndescription: Use when demonstrating the ${name} skill in tests\n---\n# ${name}\nBody.`;

function client(overrides: Partial<GitHubClient> = {}): GitHubClient {
  return {
    getRepoTree: async () => ({ entries: [], truncated: false }),
    getBlobText: async () => SKILL_MD("demo-skill"),
    getReadme: async () => "",
    getGistFiles: async () => [],
    ...overrides,
  };
}

describe("resolveTarget (repo → picker)", () => {
  it("detects skills and mini-lints each, reporting progress", async () => {
    const steps: string[] = [];
    const c = client({
      getRepoTree: async () => ({
        entries: [
          { path: "skills/alpha/SKILL.md", mode: "100644", type: "blob", sha: "a" },
          { path: "skills/beta/SKILL.md", mode: "100644", type: "blob", sha: "b" },
        ],
        truncated: false,
      }),
      getBlobText: async (_o, _r, sha) => SKILL_MD(sha === "a" ? "alpha" : "beta"),
    });
    const result = await resolveTarget(c, { kind: "repo", owner: "o", repo: "r" }, (s) => steps.push(s));
    if (result.mode !== "picker") throw new Error("expected picker");
    expect(result.skills.map((s) => s.ref.name)).toEqual(["alpha", "beta"]);
    expect(result.skills.every((s) => s.lint.ok && s.scanned)).toBe(true);
    expect(result.skills[0].lint.score).toBeGreaterThan(0);
    expect(steps.some((s) => /Analyzing/i.test(s))).toBe(true);
  });

  it("passes the truncated flag through", async () => {
    const c = client({
      getRepoTree: async () => ({
        entries: [{ path: "SKILL.md", mode: "100644", type: "blob", sha: "s" }],
        truncated: true,
      }),
    });
    const result = await resolveTarget(c, { kind: "repo", owner: "o", repo: "r" });
    expect(result.mode === "picker" && result.truncated).toBe(true);
  });
});

describe("resolveTarget (repo → links fallback)", () => {
  it("returns README repo links when no SKILL.md exists", async () => {
    const c = client({
      getRepoTree: async () => ({ entries: [{ path: "README.md", mode: "100644", type: "blob", sha: "r" }], truncated: false }),
      getReadme: async () => "[a](https://github.com/x/y)",
    });
    const result = await resolveTarget(c, { kind: "repo", owner: "o", repo: "r" });
    expect(result.mode).toBe("links");
    if (result.mode === "links") expect(result.links).toEqual([{ owner: "x", repo: "y", label: "a" }]);
  });
});

describe("resolveTarget (gist)", () => {
  it("builds a single-skill result from gist files", async () => {
    const c = client({
      getGistFiles: async () => [{ filename: "SKILL.md", content: SKILL_MD("gist-skill"), truncated: false }],
    });
    const result = await resolveTarget(c, { kind: "gist", gistId: "g1" });
    if (result.mode !== "gist") throw new Error("expected gist");
    expect(result.files.map((f) => f.path)).toContain("SKILL.md");
    expect(result.lint.ok).toBe(true);
  });

  it("returns empty when a gist has no SKILL.md", async () => {
    const c = client({ getGistFiles: async () => [{ filename: "notes.txt", content: "hi", truncated: false }] });
    const result = await resolveTarget(c, { kind: "gist", gistId: "g1" });
    expect(result.mode).toBe("empty");
  });
});
```

`components/import/ImportApp.test.tsx`:
```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ImportApp from "./ImportApp";
import type { GitHubClient } from "@/lib/github/client";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
const stash = vi.fn();
vi.mock("@/lib/handoff", () => ({ stashIncomingSkill: (...a: unknown[]) => stash(...a) }));

const SKILL_MD = `---\nname: alpha\ndescription: Use when demonstrating the alpha skill in a smoke test\n---\n# alpha\nBody.`;

function mockClient(): GitHubClient {
  return {
    getRepoTree: async () => ({
      entries: [{ path: "skills/alpha/SKILL.md", mode: "100644", type: "blob", sha: "a" }],
      truncated: false,
    }),
    getBlobText: async () => SKILL_MD,
    getReadme: async () => "",
    getGistFiles: async () => [],
  };
}

describe("ImportApp", () => {
  beforeEach(() => {
    push.mockClear();
    stash.mockClear();
    localStorage.clear();
  });

  it("resolves a pasted URL and renders picker rows with a mini-lint score", async () => {
    render(<ImportApp createClientFn={() => mockClient()} />);
    fireEvent.change(screen.getByLabelText(/repository url/i), { target: { value: "github.com/o/r" } });
    fireEvent.click(screen.getByRole("button", { name: /^import$/i }));

    expect(await screen.findByText("alpha")).toBeTruthy();
    expect(screen.getByText(/skills-dir/i)).toBeTruthy();
    // Score is rendered somewhere in the row.
    expect(screen.getByTestId("mini-score-skills/alpha")).toBeTruthy();
  });

  it("shows a friendly error for an unparseable URL", async () => {
    render(<ImportApp createClientFn={() => mockClient()} />);
    fireEvent.change(screen.getByLabelText(/repository url/i), { target: { value: "not a url" } });
    fireEvent.click(screen.getByRole("button", { name: /^import$/i }));
    expect(await screen.findByText(/doesn't look like/i)).toBeTruthy();
  });

  it("opens a skill: fetches files, stashes them, and navigates to the workspace", async () => {
    render(<ImportApp createClientFn={() => mockClient()} />);
    fireEvent.change(screen.getByLabelText(/repository url/i), { target: { value: "github.com/o/r" } });
    fireEvent.click(screen.getByRole("button", { name: /^import$/i }));
    fireEvent.click(await screen.findByRole("button", { name: /^open$/i }));

    await vi.waitFor(() => expect(stash).toHaveBeenCalledTimes(1));
    expect(stash.mock.calls[0][1]).toMatchObject({ dirName: "alpha", source: expect.stringContaining("github") });
    expect(push).toHaveBeenCalledWith("/workspace");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/github/importFlow.test.ts components/import/ImportApp.test.tsx`
Expected: FAIL — modules not found (and possibly the component glob is not yet in vitest config; Step 3 fixes that).

- [ ] **Step 3: Ensure `vitest.config.ts` includes components + jsdom** (idempotent — Plan 3 may already have done this)

`vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
  test: {
    include: ["lib/**/*.test.ts", "components/**/*.test.tsx"],
    environmentMatchGlobs: [["components/**", "jsdom"]],
  },
});
```

- [ ] **Step 4: Implement miniLint.ts**

```ts
import { lintSkill } from "@/lib/skill-lint";

export interface MiniLint {
  ok: boolean;
  score: number;
  errors: number;
  warnings: number;
  reason?: string;
}

/** Runs the full engine on just the SKILL.md text (references are absent → their rules stay quiet). */
export function miniLint(skillMd: string, dirName?: string): MiniLint {
  const r = lintSkill([{ path: "SKILL.md", content: skillMd }], { dirName });
  if (r.kind !== "skill") {
    return { ok: false, score: 0, errors: 0, warnings: 0, reason: r.reason };
  }
  return {
    ok: true,
    score: r.score.value,
    errors: r.findings.filter((f) => f.severity === "error").length,
    warnings: r.findings.filter((f) => f.severity === "warning").length,
  };
}
```

- [ ] **Step 5: Implement importFlow.ts**

```ts
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
```

- [ ] **Step 6: Implement the presentational components**

`components/import/TokenField.tsx`:
```tsx
"use client";
import { useState } from "react";

export default function TokenField({ token, onChange }: { token: string; onChange: (t: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2 text-sm">
      <button type="button" onClick={() => setOpen((v) => !v)} className="text-blue-600 underline">
        {open ? "Hide" : "GitHub token (optional)"}
      </button>
      {open && (
        <div className="mt-2 flex flex-col gap-1">
          <label htmlFor="gh-token" className="text-gray-600">
            Personal access token — raises the rate limit and unlocks private repos.
          </label>
          <input
            id="gh-token"
            type="password"
            value={token}
            onChange={(e) => onChange(e.target.value)}
            placeholder="ghp_…"
            className="rounded border px-2 py-1"
            autoComplete="off"
          />
          <span className="text-xs text-gray-500">Stored locally only, in this browser (localStorage). Never sent anywhere but github.com.</span>
        </div>
      )}
    </div>
  );
}
```

`components/import/ErrorPanel.tsx`:
```tsx
"use client";
import { GitHubError, NotFoundError, RateLimitError } from "@/lib/github/client";

export default function ErrorPanel({ error, onNeedToken }: { error: unknown; onNeedToken: () => void }) {
  if (error instanceof RateLimitError) {
    const when = error.resetEpoch ? new Date(error.resetEpoch * 1000).toLocaleTimeString() : "soon";
    return (
      <div className="rounded border border-amber-400 bg-amber-50 p-4">
        <h2 className="font-semibold">GitHub rate limit reached</h2>
        <p className="mt-1 text-sm">Anonymous requests are limited to 60/hour. Resets around {when}.</p>
        <button type="button" onClick={onNeedToken} className="mt-2 text-sm text-blue-600 underline">
          Add a token to raise the limit to 5,000/hour
        </button>
      </div>
    );
  }
  const message =
    error instanceof NotFoundError
      ? error.message
      : error instanceof GitHubError
        ? `GitHub error ${error.status}: ${error.message}`
        : error instanceof Error
          ? error.message
          : "Something went wrong.";
  return (
    <div className="rounded border border-red-400 bg-red-50 p-4">
      <h2 className="font-semibold">Import failed</h2>
      <p className="mt-1 text-sm">{message}</p>
    </div>
  );
}
```

`components/import/LinksList.tsx`:
```tsx
"use client";
import type { RepoLink } from "@/lib/github/links";

export default function LinksList({ links, onScan }: { links: RepoLink[]; onScan: (link: RepoLink) => void }) {
  if (links.length === 0) {
    return <p className="text-sm text-gray-600">No skills and no linked GitHub repos were found in this repository.</p>;
  }
  return (
    <div>
      <p className="mb-2 text-sm text-gray-600">
        No SKILL.md here — but this looks like an awesome-list. Pick a linked repo to scan:
      </p>
      <ul className="divide-y rounded border">
        {links.map((l) => (
          <li key={`${l.owner}/${l.repo}`} className="flex items-center justify-between px-3 py-2">
            <span className="text-sm">
              <span className="font-medium">{l.label}</span>{" "}
              <span className="text-gray-500">
                {l.owner}/{l.repo}
              </span>
            </span>
            <button type="button" onClick={() => onScan(l)} className="rounded bg-blue-600 px-3 py-1 text-sm text-white">
              Scan
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

`components/import/SkillPicker.tsx`:
```tsx
"use client";
import type { PickerSkill } from "@/lib/github/importFlow";

const ORIGIN_LABEL: Record<string, string> = {
  "skills-dir": "skills-dir",
  "harness-dir": "harness-dir",
  "category-dir": "category-dir",
  root: "root",
  plugin: "plugin",
};

export default function SkillPicker({
  skills,
  busyDir,
  onOpen,
}: {
  skills: PickerSkill[];
  busyDir: string | null;
  onOpen: (skill: PickerSkill) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b text-gray-500">
            <th className="py-2 pr-4">Skill</th>
            <th className="py-2 pr-4">Origin</th>
            <th className="py-2 pr-4">Path</th>
            <th className="py-2 pr-4">Score</th>
            <th className="py-2 pr-4">Issues</th>
            <th className="py-2" />
          </tr>
        </thead>
        <tbody>
          {skills.map((s) => (
            <tr key={s.ref.dirPath || s.ref.name} className="border-b">
              <td className="py-2 pr-4 font-medium">
                {s.ref.name}
                {s.ref.viaSymlink && <span className="ml-1 text-xs text-gray-400">(symlink)</span>}
              </td>
              <td className="py-2 pr-4">
                <span className="rounded bg-gray-100 px-2 py-0.5 text-xs">{ORIGIN_LABEL[s.ref.origin]}</span>
                {s.ref.pluginName && <span className="ml-1 text-xs text-gray-500">{s.ref.pluginName}</span>}
              </td>
              <td className="py-2 pr-4 font-mono text-xs text-gray-500">{s.ref.dirPath || "(root)"}</td>
              <td className="py-2 pr-4" data-testid={`mini-score-${s.ref.dirPath || s.ref.name}`}>
                {s.scanned && s.lint.ok ? s.lint.score : "—"}
              </td>
              <td className="py-2 pr-4 text-xs">
                {s.scanned && s.lint.ok ? (
                  <span>
                    <span className="text-red-600">{s.lint.errors}E</span> /{" "}
                    <span className="text-amber-600">{s.lint.warnings}W</span>
                  </span>
                ) : (
                  <span className="text-gray-400">{s.lint.reason ?? "not scanned"}</span>
                )}
              </td>
              <td className="py-2 text-right">
                <button
                  type="button"
                  disabled={busyDir === s.ref.dirPath}
                  onClick={() => onOpen(s)}
                  className="rounded bg-blue-600 px-3 py-1 text-white disabled:opacity-50"
                >
                  {busyDir === s.ref.dirPath ? "Opening…" : "Open"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 7: Implement the container `ImportApp.tsx`** (state machine + token persistence)

`components/import/ImportApp.tsx`:
```tsx
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { stashIncomingSkill } from "@/lib/handoff";
import { createClient, type GitHubClient } from "@/lib/github/client";
import { parseGitHubUrl } from "@/lib/github/url";
import { resolveTarget, type ImportResult, type PickerSkill } from "@/lib/github/importFlow";
import { fetchSkillFiles } from "@/lib/github/fetchSkill";
import type { RepoLink } from "@/lib/github/links";
import TokenField from "./TokenField";
import SkillPicker from "./SkillPicker";
import LinksList from "./LinksList";
import ErrorPanel from "./ErrorPanel";

const TOKEN_KEY = "skillsmith:gh-pat";

type View =
  | { s: "idle" }
  | { s: "loading"; step: string }
  | { s: "result"; result: ImportResult }
  | { s: "error"; error: unknown };

export interface ImportAppProps {
  /** Injectable for tests; defaults to the real fetch-backed client. */
  createClientFn?: (opts: { token?: string; fetchFn?: typeof fetch }) => GitHubClient;
}

export default function ImportApp({ createClientFn = createClient }: ImportAppProps) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [token, setToken] = useState("");
  const [view, setView] = useState<View>({ s: "idle" });
  const [busyDir, setBusyDir] = useState<string | null>(null);

  // Token lives only in localStorage, read/written in the UI layer.
  useEffect(() => {
    try {
      setToken(localStorage.getItem(TOKEN_KEY) ?? "");
    } catch {
      /* storage blocked — degrade to in-memory only */
    }
  }, []);
  function updateToken(t: string) {
    setToken(t);
    try {
      if (t) localStorage.setItem(TOKEN_KEY, t);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignore quota/security errors — spec §11 */
    }
  }

  function makeClient(): GitHubClient {
    return createClientFn({ token: token || undefined, fetchFn: fetch });
  }

  async function run(inputUrl: string) {
    const target = parseGitHubUrl(inputUrl);
    if (!target) {
      setView({ s: "error", error: new Error("That doesn't look like a GitHub repo, gist, or owner/repo.") });
      return;
    }
    setView({ s: "loading", step: "Resolving…" });
    try {
      const result = await resolveTarget(makeClient(), target, (step) => setView({ s: "loading", step }));
      setView({ s: "result", result });
    } catch (error) {
      setView({ s: "error", error });
    }
  }

  async function openSkill(owner: string, repo: string, ref: string, entries: PickerEntries, skill: PickerSkill) {
    setBusyDir(skill.ref.dirPath);
    try {
      const fetched = await fetchSkillFiles(makeClient(), owner, repo, ref, skill.ref, entries);
      stashIncomingSkill(fetched.files, { dirName: fetched.dirName, source: `github:${owner}/${repo}` });
      router.push("/workspace");
    } catch (error) {
      setView({ s: "error", error });
    } finally {
      setBusyDir(null);
    }
  }

  function scanLinkedRepo(link: RepoLink) {
    setUrl(`${link.owner}/${link.repo}`);
    void run(`${link.owner}/${link.repo}`);
  }

  function openGist(result: Extract<ImportResult, { mode: "gist" }>) {
    stashIncomingSkill(result.files, { dirName: result.dirName, source: "github:gist" });
    router.push("/workspace");
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-bold">Import a skill from GitHub</h1>
      <p className="mt-1 text-sm text-gray-600">Paste a repo, gist, or owner/repo. Everything runs in your browser.</p>

      <form
        className="mt-4"
        onSubmit={(e) => {
          e.preventDefault();
          void run(url);
        }}
      >
        <label htmlFor="repo-url" className="block text-sm font-medium">
          Repository URL
        </label>
        <div className="mt-1 flex gap-2">
          <input
            id="repo-url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://github.com/owner/repo"
            className="flex-1 rounded border px-3 py-2"
          />
          <button type="submit" className="rounded bg-blue-600 px-4 py-2 text-white">
            Import
          </button>
        </div>
        <TokenField token={token} onChange={updateToken} />
      </form>

      <section className="mt-6">
        {view.s === "loading" && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" aria-hidden />
            <span>{view.step}</span>
          </div>
        )}

        {view.s === "error" && (
          <ErrorPanel error={view.error} onNeedToken={() => document.getElementById("gh-token")?.focus()} />
        )}

        {view.s === "result" && view.result.mode === "links" && (
          <LinksList links={view.result.links} onScan={scanLinkedRepo} />
        )}

        {view.s === "result" && view.result.mode === "empty" && (
          <p className="text-sm text-gray-600">{view.result.reason}</p>
        )}

        {view.s === "result" && view.result.mode === "gist" && (
          <div className="rounded border p-4">
            <p className="text-sm">
              Gist skill <span className="font-medium">{view.result.dirName}</span> — score{" "}
              {view.result.lint.ok ? view.result.lint.score : "n/a"}.
            </p>
            <button
              type="button"
              onClick={() => openGist(view.result as Extract<ImportResult, { mode: "gist" }>)}
              className="mt-2 rounded bg-blue-600 px-3 py-1 text-white"
            >
              Open
            </button>
          </div>
        )}

        {view.s === "result" && view.result.mode === "picker" && (
          <div>
            {view.result.truncated && (
              <div className="mb-3 rounded border border-amber-400 bg-amber-50 p-3 text-sm">
                This repository is very large; GitHub truncated the file tree, so these results are partial. Import a
                subfolder URL (…/tree/main/path) for complete results.
              </div>
            )}
            <p className="mb-2 text-sm text-gray-600">
              Found {view.result.skills.length} skill{view.result.skills.length === 1 ? "" : "s"}.
            </p>
            <SkillPicker
              skills={view.result.skills}
              busyDir={busyDir}
              onOpen={(skill) =>
                view.result.mode === "picker" &&
                openSkill(view.result.owner, view.result.repo, view.result.ref, view.result.entries, skill)
              }
            />
          </div>
        )}
      </section>
    </main>
  );
}

type PickerEntries = Extract<ImportResult, { mode: "picker" }>["entries"];
```

`app/import/page.tsx`:
```tsx
import ImportApp from "@/components/import/ImportApp";

export default function ImportPage() {
  return <ImportApp />;
}
```

- [ ] **Step 8: Run the new tests to verify they pass**

Run: `npx vitest run lib/github/importFlow.test.ts components/import/ImportApp.test.tsx`
Expected: PASS (all tests).

- [ ] **Step 9: Commit**

```bash
git add lib/github/miniLint.ts lib/github/importFlow.ts lib/github/importFlow.test.ts app/import components/import vitest.config.ts
git commit -m "feat(import): /import page — resolve flow, picker, links, error states, mini-lint"
```

---

### Task 6: Collection audit + final wiring, full suite, build, commit

**Files:**
- Create: `components/import/CollectionAudit.tsx`
- Test: `components/import/CollectionAudit.test.tsx`
- Edit: `components/import/ImportApp.tsx` (mount the audit when >3 skills)

**Interfaces:**
- Consumes: `PickerSkill` from `@/lib/github/importFlow`
- Produces: `export default function CollectionAudit({ skills }: { skills: PickerSkill[] })`

- [ ] **Step 1: Write the failing test**

`components/import/CollectionAudit.test.tsx`:
```tsx
// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import CollectionAudit from "./CollectionAudit";
import type { PickerSkill } from "@/lib/github/importFlow";

function s(name: string, score: number, errors: number): PickerSkill {
  return { ref: { dirPath: `skills/${name}`, name, origin: "skills-dir", viaSymlink: false }, lint: { ok: true, score, errors, warnings: 0 }, scanned: true };
}

describe("CollectionAudit", () => {
  const skills = [s("a", 40, 3), s("b", 95, 0), s("c", 70, 1)];

  it("reveals a sortable table behind the audit button and sorts by score", () => {
    render(<CollectionAudit skills={skills} />);
    fireEvent.click(screen.getByRole("button", { name: /audit whole collection/i }));

    // Default sort: worst score first.
    const rows = screen.getAllByRole("row").slice(1); // drop header
    expect(within(rows[0]).getByText("a")).toBeTruthy();
    expect(within(rows[2]).getByText("b")).toBeTruthy();

    // Toggling the Score header flips the order (best first).
    fireEvent.click(screen.getByRole("button", { name: /^score$/i }));
    const flipped = screen.getAllByRole("row").slice(1);
    expect(within(flipped[0]).getByText("b")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run components/import/CollectionAudit.test.tsx`
Expected: FAIL — "Cannot find module './CollectionAudit'".

- [ ] **Step 3: Implement CollectionAudit.tsx**

```tsx
"use client";
import { useMemo, useState } from "react";
import type { PickerSkill } from "@/lib/github/importFlow";

type SortKey = "name" | "score" | "errors";

export default function CollectionAudit({ skills }: { skills: PickerSkill[] }) {
  const [open, setOpen] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [asc, setAsc] = useState(true); // score ascending = worst first

  const scanned = useMemo(() => skills.filter((s) => s.scanned && s.lint.ok), [skills]);

  const sorted = useMemo(() => {
    const dir = asc ? 1 : -1;
    return [...scanned].sort((a, b) => {
      if (sortKey === "name") return dir * a.ref.name.localeCompare(b.ref.name);
      if (sortKey === "errors") return dir * (a.lint.errors - b.lint.errors);
      return dir * (a.lint.score - b.lint.score);
    });
  }, [scanned, sortKey, asc]);

  function sortBy(key: SortKey) {
    if (key === sortKey) setAsc((v) => !v);
    else {
      setSortKey(key);
      setAsc(true);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mb-3 rounded border px-3 py-1 text-sm text-blue-600"
      >
        Audit whole collection ({scanned.length} scanned)
      </button>
    );
  }

  const header = (key: SortKey, label: string) => (
    <th className="py-2 pr-4">
      <button type="button" onClick={() => sortBy(key)} className="font-medium hover:underline">
        {label}
      </button>
    </th>
  );

  return (
    <div className="mb-4 overflow-x-auto rounded border p-3">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Collection audit — {scanned.length} skills</h2>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-gray-500 underline">
          Hide
        </button>
      </div>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b text-gray-500">
            {header("name", "Skill")}
            {header("score", "Score")}
            {header("errors", "Errors")}
          </tr>
        </thead>
        <tbody>
          {sorted.map((s) => (
            <tr key={s.ref.dirPath || s.ref.name} className="border-b">
              <td className="py-2 pr-4 font-medium">{s.ref.name}</td>
              <td className="py-2 pr-4">{s.lint.score}</td>
              <td className="py-2 pr-4">{s.lint.errors}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 4: Wire the audit into `ImportApp.tsx`** (show when >3 skills, above the picker)

Add the import near the other component imports:
```tsx
import CollectionAudit from "./CollectionAudit";
```

Then, inside the `picker` branch, render the audit above `<SkillPicker … />` — replace:
```tsx
            <p className="mb-2 text-sm text-gray-600">
              Found {view.result.skills.length} skill{view.result.skills.length === 1 ? "" : "s"}.
            </p>
            <SkillPicker
```
with:
```tsx
            <p className="mb-2 text-sm text-gray-600">
              Found {view.result.skills.length} skill{view.result.skills.length === 1 ? "" : "s"}.
            </p>
            {view.result.skills.length > 3 && <CollectionAudit skills={view.result.skills} />}
            <SkillPicker
```

- [ ] **Step 5: Run the audit test**

Run: `npx vitest run components/import/CollectionAudit.test.tsx`
Expected: PASS.

- [ ] **Step 6: Run the full suite**

Run: `npm test`
Expected: PASS — every file green (engine suite from Plans 1–4 plus url, client, detect, fetchSkill, links, importFlow, ImportApp, CollectionAudit).

- [ ] **Step 7: Verify the static export build**

Run: `npm run build`
Expected: build succeeds; `out/import/index.html` exists (verify with `ls out/import/index.html`). No server code, no dynamic routes.

- [ ] **Step 8: Commit**

```bash
git add components/import/CollectionAudit.tsx components/import/CollectionAudit.test.tsx components/import/ImportApp.tsx
git commit -m "feat(import): sortable collection audit and final /import wiring"
```

---

## Self-Review (run after writing, before handoff)

1. **Spec coverage (Plan 5 scope):** spec §9 layout detection order — (1) recursive `SKILL.md` glob → Task 3; (2) marketplace/`plugin.json` attribution → Task 3; (3) harness paths + `skills/` category nesting → Task 3; (4) mode-`120000` symlink dedup → Task 3; (5) direct subfolder URL (`subPath` filter) → Task 1 (parse) + Task 3 (filter); (6) gists single-file → Task 2 (`getGistFiles`) + Task 5 (`resolveGist`); (7) awesome-list README links → Task 4 (`extractRepoLinks`) + Task 5 (links mode). Mini-score + collection audit → Tasks 5–6. Spec §11 errors — rate-limit/not-found/other mapping (Task 2), truncated-tree banner (Task 5), 2 MB file cap (Task 4), localStorage degrade-in-place (Task 5 `try/catch`).
2. **Contract fidelity:** `SkillFile = {path, content, symlink?}` (fetchSkill emits exactly this); `stashIncomingSkill(files, {dirName, source})` then `router.push("/workspace")` (ImportApp `openSkill`/`openGist`); `lintSkill(files, {dirName})` (miniLint). Types imported from `@/lib/skill-lint` and `@/lib/handoff`, never redefined.
3. **Static-export safety:** no `process.env`, no `fs`, no API routes, no server components with data fetching. All fetches hit `api.github.com` from `"use client"` components; the lib is fetch-injectable. Token only ever read/written via `localStorage` in `ImportApp`.
4. **Symlink dedup is complete code** (Task 3 `detectSkills`): candidate grouping by folder name, canonical-vs-symlink split, dedup-by-`dirPath` preferring exact `SKILL.md`, symlink-only skills flagged `viaSymlink:true`. No prose stand-ins.
5. **Placeholder scan:** none — every step carries complete code or exact commands.
6. **Ambiguities resolved (documented inline):** (a) `DetectedSkillRef` shape is fixed, so case-variant `skill.md` skills are emitted as normal refs and surfaced as importable-with-warning by the engine's E08 rule rather than via an extra field; (b) branch refs containing slashes are treated as a single `tree/<ref>/…` segment (not disambiguable from a URL); (c) flat top-level skill folders (boraoztunc) that are not under `skills/`, a harness dir, or a plugin are classified `skills-dir`; (d) `resolveTarget` mini-lints up to `MINI_LINT_CAP = 30` skills during load (progress shown), and `CollectionAudit` re-presents those results as a sortable table rather than re-fetching.
