# Skillsmith Plan 6: Full GitHub Integration (publish + bulk download) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Two-way GitHub integration, 100% client-side: (A) **publish** a skill from the workspace to GitHub — a brand-new repo (`auto_init`) or an existing repo at a path prefix — using the user's PAT; (B) **bulk-download** every detected skill from a repo as a single `.zip` in the `/import` picker.

**Architecture:** `lib/github/client.ts` gains the Git-data write methods (blobs → tree → commit → ref) behind the same injectable `GitHubClient` interface. A new pure module `lib/github/publish.ts` orchestrates the publish flow against the *client object* (never `fetch`). A new pure module `lib/github/bulkFetch.ts` fans skills out sequentially (each `fetchSkillFiles` already runs 4-wide internally) and hands groups to a new `zipCollection()` in `lib/zip.ts`. The UI layer (`PublishDialog` in the workspace, a "Download all" button in `SkillPicker`'s host `ImportApp`) owns the PAT (localStorage `skillsmith:gh-pat`) and mocks the lib in tests. Spec: `docs/specs/2026-07-04-skillsmith-design.md`.

**Tech Stack:** Next.js 15 (static export) + React 19 + Tailwind 4, TypeScript strict, Vitest 3 (jsdom for components via `// @vitest-environment jsdom`), `fflate` for zips. Node 20+. npm.

**Roadmap context:** This is Plan 6, building on Plans 1–5 (engine, rule catalog, workspace UI + export, wizard, GitHub *read* importer). It consumes those read-only except the named integration points.

## Global Constraints

- Static export stays intact: `output: 'export'` — no server code, no API routes. Every new capability runs in the browser.
- The PAT lives only in the UI layer, in localStorage under `skillsmith:gh-pat`, is passed to `createClient({ token })`, is NEVER logged, and reaches only `api.github.com`.
- `lib/github/*` stays pure and injectable: publish/bulk tests mock the **client object**; UI tests mock the **lib** (`@/lib/github/publish`, `@/lib/zip`) — never `fetch`.
- Every dialog and status line renders untrusted values (repo names, branch names, GitHub error messages) as JSX **text**, never `dangerouslySetInnerHTML`.
- The engine and existing pages are consumed read-only except: `lib/github/client.ts` (extended), `lib/zip.ts` (one new export), `app/workspace/page.tsx` (header button), `components/import/ImportApp.tsx` (bulk button). `fetchSkill.ts` gains one `export` keyword only.
- Writes without a token throw a friendly `GitHubError` **before any network call**.
- Follow existing patterns exactly: `mk`-free lib code, the `mockFetch` helper shape in `client.test.ts`, the mocked-client object shape in `ImportApp.test.tsx`, `busyDir` disable pattern, `afterEach(cleanup)` (global in `vitest.setup.ts`), controlled `open`/`onToggle` props.
- Run all commands from repo root `C:\Users\richa\projects\skillsmith`.

---

### Task 1: GitHub client write methods (`lib/github/client.ts` extension)

**Files:**
- Edit: `lib/github/client.ts`
- Test: `lib/github/client.test.ts` (append a `describe("write methods")` block — do not rewrite existing tests)

**Interfaces:**
- Consumes: existing `GitHubError`, `NotFoundError`, `RateLimitError`, `mapError`, `createClient` internals.
- Produces (added to the `GitHubClient` interface and the returned object):

```ts
getUser(): Promise<{ login: string }>;
getDefaultBranch(owner: string, repo: string): Promise<{ defaultBranch: string }>;
createRepo(opts: { name: string; isPrivate: boolean; description?: string }): Promise<{
  owner: string; repo: string; defaultBranch: string; htmlUrl: string;
}>;
getRef(owner: string, repo: string, branch: string): Promise<{ sha: string }>;
getCommit(owner: string, repo: string, sha: string): Promise<{ treeSha: string }>;
createBlob(owner: string, repo: string, contentUtf8: string): Promise<{ sha: string }>;
createTree(owner: string, repo: string, baseTreeSha: string, entries: { path: string; sha: string }[]): Promise<{ sha: string }>;
createCommit(owner: string, repo: string, opts: { message: string; treeSha: string; parentSha: string }): Promise<{ sha: string }>;
updateRef(owner: string, repo: string, branch: string, commitSha: string): Promise<void>;
```

> **Ambiguity resolved:** the fixed design specifies "existing branch default = repo `default_branch` (GET /repos)". The read `GET /repos/{owner}/{repo}` already lives inside `getRepoTree`; rather than reshape that method, this task exposes a tiny read companion `getDefaultBranch` (guard-free, GET only) so `publish.ts` stays pure. It is the "reuse existing repoMeta path" the brief calls for.

- [ ] **Step 1: Write the failing tests** — append to `lib/github/client.test.ts`

```ts
describe("write methods: auth guard", () => {
  it("throws a friendly GitHubError before any network call when no token is set", async () => {
    let called = 0;
    const fetchFn = (async () => {
      called++;
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;
    const client = createClient({ fetchFn });
    await expect(client.createBlob("o", "r", "hi")).rejects.toBeInstanceOf(GitHubError);
    await client.createBlob("o", "r", "hi").catch((e: GitHubError) => {
      expect(e.message).toMatch(/token with repo scope is required/i);
    });
    expect(called).toBe(0);
  });

  it("guards createRepo, createTree, createCommit and updateRef the same way", async () => {
    const client = createClient({}); // no fetchFn, no token — must never reach fetch
    await expect(client.createRepo({ name: "x", isPrivate: false })).rejects.toBeInstanceOf(GitHubError);
    await expect(client.createTree("o", "r", "base", [])).rejects.toBeInstanceOf(GitHubError);
    await expect(client.createCommit("o", "r", { message: "m", treeSha: "t", parentSha: "p" })).rejects.toBeInstanceOf(GitHubError);
    await expect(client.updateRef("o", "r", "main", "c")).rejects.toBeInstanceOf(GitHubError);
  });
});

describe("write methods: happy paths", () => {
  it("getUser returns the login", async () => {
    const fetchFn = mockFetch({ "/user": { body: { login: "octocat", id: 1 } } });
    expect(await createClient({ token: "t", fetchFn }).getUser()).toEqual({ login: "octocat" });
  });

  it("getDefaultBranch reads default_branch from the repo metadata", async () => {
    const fetchFn = mockFetch({ "/repos/o/r": { body: { default_branch: "trunk" } } });
    expect(await createClient({ fetchFn }).getDefaultBranch("o", "r")).toEqual({ defaultBranch: "trunk" });
  });

  it("createRepo posts auto_init and maps the response fields", async () => {
    let seen: { method?: string; body?: unknown } = {};
    const fetchFn = (async (_url: string, init?: RequestInit) => {
      seen = { method: init?.method, body: init?.body ? JSON.parse(String(init.body)) : undefined };
      return new Response(
        JSON.stringify({ name: "my-skill", owner: { login: "octocat" }, default_branch: "main", html_url: "https://github.com/octocat/my-skill" }),
        { status: 201, headers: { "content-type": "application/json" } }
      );
    }) as unknown as typeof fetch;
    const out = await createClient({ token: "t", fetchFn }).createRepo({ name: "my-skill", isPrivate: true, description: "d" });
    expect(seen.method).toBe("POST");
    expect(seen.body).toMatchObject({ name: "my-skill", private: true, description: "d", auto_init: true });
    expect(out).toEqual({ owner: "octocat", repo: "my-skill", defaultBranch: "main", htmlUrl: "https://github.com/octocat/my-skill" });
  });

  it("getRef and getCommit unwrap the git-data shapes", async () => {
    const fetchFn = mockFetch({
      "/repos/o/r/git/ref/heads/main": { body: { object: { sha: "headsha" } } },
      "/repos/o/r/git/commits/headsha": { body: { tree: { sha: "treesha" } } },
    });
    const client = createClient({ token: "t", fetchFn });
    expect(await client.getRef("o", "r", "main")).toEqual({ sha: "headsha" });
    expect(await client.getCommit("o", "r", "headsha")).toEqual({ treeSha: "treesha" });
  });

  it("createBlob posts utf-8 content and returns the sha", async () => {
    let body: unknown;
    const fetchFn = (async (_url: string, init?: RequestInit) => {
      body = init?.body ? JSON.parse(String(init.body)) : undefined;
      return new Response(JSON.stringify({ sha: "blobsha" }), { status: 201, headers: { "content-type": "application/json" } });
    }) as unknown as typeof fetch;
    const out = await createClient({ token: "t", fetchFn }).createBlob("o", "r", "hello");
    expect(body).toEqual({ content: "hello", encoding: "utf-8" });
    expect(out).toEqual({ sha: "blobsha" });
  });

  it("createTree sends base_tree and 100644 blob entries", async () => {
    let body: { base_tree?: string; tree?: unknown[] } = {};
    const fetchFn = (async (_url: string, init?: RequestInit) => {
      body = init?.body ? JSON.parse(String(init.body)) : {};
      return new Response(JSON.stringify({ sha: "treesha" }), { status: 201, headers: { "content-type": "application/json" } });
    }) as unknown as typeof fetch;
    const out = await createClient({ token: "t", fetchFn }).createTree("o", "r", "basesha", [{ path: "SKILL.md", sha: "b1" }]);
    expect(body.base_tree).toBe("basesha");
    expect(body.tree).toEqual([{ path: "SKILL.md", mode: "100644", type: "blob", sha: "b1" }]);
    expect(out).toEqual({ sha: "treesha" });
  });

  it("createCommit sends message/tree/parents and returns the sha", async () => {
    let body: unknown;
    const fetchFn = (async (_url: string, init?: RequestInit) => {
      body = init?.body ? JSON.parse(String(init.body)) : undefined;
      return new Response(JSON.stringify({ sha: "commitsha" }), { status: 201, headers: { "content-type": "application/json" } });
    }) as unknown as typeof fetch;
    const out = await createClient({ token: "t", fetchFn }).createCommit("o", "r", { message: "Add skill", treeSha: "t", parentSha: "p" });
    expect(body).toEqual({ message: "Add skill", tree: "t", parents: ["p"] });
    expect(out).toEqual({ sha: "commitsha" });
  });

  it("updateRef PATCHes refs/heads with force:false", async () => {
    let seen: { url?: string; method?: string; body?: unknown } = {};
    const fetchFn = (async (url: string, init?: RequestInit) => {
      seen = { url: String(url), method: init?.method, body: init?.body ? JSON.parse(String(init.body)) : undefined };
      return new Response(JSON.stringify({ ref: "refs/heads/main", object: { sha: "commitsha" } }), { status: 200, headers: { "content-type": "application/json" } });
    }) as unknown as typeof fetch;
    await createClient({ token: "t", fetchFn }).updateRef("o", "r", "main", "commitsha");
    expect(seen.url).toContain("/repos/o/r/git/refs/heads/main");
    expect(seen.method).toBe("PATCH");
    expect(seen.body).toEqual({ sha: "commitsha", force: false });
  });
});

describe("write methods: error mapping", () => {
  it("maps a 401 to a GitHubError carrying the API message", async () => {
    const fetchFn = mockFetch({ "/user": { status: 401, body: { message: "Bad credentials" } } });
    await createClient({ token: "bad", fetchFn })
      .getUser()
      .catch((e: unknown) => {
        expect(e).toBeInstanceOf(GitHubError);
        expect((e as GitHubError).status).toBe(401);
        expect((e as GitHubError).message).toBe("Bad credentials");
      });
  });

  it("passes a 422 name-already-exists message straight through", async () => {
    const fetchFn = mockFetch({
      "/user/repos": { status: 422, body: { message: "name already exists on this account" } },
    });
    await createClient({ token: "t", fetchFn })
      .createRepo({ name: "dup", isPrivate: false })
      .catch((e: unknown) => {
        expect(e).toBeInstanceOf(GitHubError);
        expect((e as GitHubError).status).toBe(422);
        expect((e as GitHubError).message).toMatch(/already exists/i);
      });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/github/client.test.ts`
Expected: FAIL — `client.getUser is not a function`, etc.

- [ ] **Step 3: Extend `client.ts`** — add the methods to the interface, add the shared `api` helper + token guard, and add the methods to the returned object.

First, extend the `GitHubClient` interface (add the nine signatures listed in **Interfaces** above to the existing interface — keep the four read methods).

Then, inside `createClient`, replace the private `getJson` with a general `api` helper and route `getJson` through it (existing read methods keep calling `getJson` unchanged):

```ts
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
```

Then add the new methods (place after `getGistFiles`, before the `return { … }`):

```ts
  async function getUser(): Promise<{ login: string }> {
    requireToken();
    const data = await api<{ login: string }>(`/user`);
    return { login: data.login };
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
      `/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(branch)}`
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
    await api(`/repos/${owner}/${repo}/git/refs/heads/${encodeURIComponent(branch)}`, {
      method: "PATCH",
      body: { sha: commitSha, force: false },
    });
  }
```

Finally, add all nine to the returned object:

```ts
  return {
    getRepoTree,
    getBlobText,
    getReadme,
    getGistFiles,
    getUser,
    getDefaultBranch,
    createRepo,
    getRef,
    getCommit,
    createBlob,
    createTree,
    createCommit,
    updateRef,
  };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/github/client.test.ts`
Expected: PASS (existing + new write-method tests).

- [ ] **Step 5: Commit**

```bash
git add lib/github/client.ts lib/github/client.test.ts
git commit -m "feat(github): git-data write methods (blob/tree/commit/ref) with token guard"
```

---

### Task 2: Publish orchestration (`lib/github/publish.ts`)

**Files:**
- Edit: `lib/github/fetchSkill.ts` (add `export` to `mapWithConcurrency` — one keyword)
- Create: `lib/github/publish.ts`
- Test: `lib/github/publish.test.ts`

**Interfaces:**
- Consumes: `GitHubClient` (Task 1), `SkillFile`, `mapWithConcurrency` (now exported from `./fetchSkill`).
- Produces:

```ts
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
  /** relative paths of symlink files that were not published */
  skipped: string[];
}

export function publishSkill(client: GitHubClient, opts: PublishOptions): Promise<PublishResult>;
```

Flow:
- **new-repo**: `createRepo({ auto_init:true })` → poll `getRef(defaultBranch)` (3 tries, 800 ms — the `auto_init` commit can lag) → files land at the **repo root** (`path = f.path`) → `htmlUrl` is the repo's `html_url`.
- **existing**: `branch = target.branch || (await getDefaultBranch()).defaultBranch`; `pathPrefix` defaults to `skills/${dirName}`; each path = `${prefix}/${f.path}` (double slashes normalized); base = current head commit's tree; blobs via `mapWithConcurrency(4)` → `createTree(base_tree)` → `createCommit(parent)` → `updateRef`. `htmlUrl` = `https://github.com/${owner}/${repo}`.
- **Symlink** `SkillFile`s (`symlink === true`) are skipped (their `content` is a path target, not bytes) and recorded in `skipped`.

- [ ] **Step 1: Export `mapWithConcurrency`** — in `lib/github/fetchSkill.ts` change the declaration:

```ts
/** Run an async mapper over items with a bounded number of workers, preserving order. */
export async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
```

(No other change to that file.)

- [ ] **Step 2: Write the failing tests**

`lib/github/publish.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest";
import { publishSkill } from "./publish";
import { GitHubError, type GitHubClient } from "./client";
import type { SkillFile } from "@/lib/skill-lint";

const FILES: SkillFile[] = [
  { path: "SKILL.md", content: "---\nname: demo\ndescription: x\n---\nbody" },
  { path: "references/api.md", content: "ref" },
];

/** A fully-stubbed client; each test overrides what it needs. */
function stubClient(over: Partial<GitHubClient> = {}): GitHubClient {
  return {
    getRepoTree: vi.fn(),
    getBlobText: vi.fn(),
    getReadme: vi.fn(),
    getGistFiles: vi.fn(),
    getUser: vi.fn(),
    getDefaultBranch: vi.fn(async () => ({ defaultBranch: "main" })),
    createRepo: vi.fn(async () => ({ owner: "octo", repo: "demo", defaultBranch: "main", htmlUrl: "https://github.com/octo/demo" })),
    getRef: vi.fn(async () => ({ sha: "headsha" })),
    getCommit: vi.fn(async () => ({ treeSha: "basetree" })),
    createBlob: vi.fn(async () => ({ sha: "blobsha" })),
    createTree: vi.fn(async () => ({ sha: "newtree" })),
    createCommit: vi.fn(async () => ({ sha: "newcommit" })),
    updateRef: vi.fn(async () => {}),
    ...over,
  } as GitHubClient;
}

describe("publishSkill — new repo", () => {
  it("creates the repo, commits files at the root, and returns the repo URL", async () => {
    const client = stubClient();
    const res = await publishSkill(client, {
      target: { mode: "new-repo", name: "demo", isPrivate: false },
      files: FILES,
      dirName: "demo",
      message: "Add demo skill",
    });
    expect(client.createRepo).toHaveBeenCalledWith({ name: "demo", isPrivate: false, description: undefined });
    // Files land at the repo root (no prefix).
    const treeEntries = (client.createTree as ReturnType<typeof vi.fn>).mock.calls[0][3];
    expect(treeEntries.map((e: { path: string }) => e.path).sort()).toEqual(["SKILL.md", "references/api.md"]);
    expect(client.createCommit).toHaveBeenCalledWith("octo", "demo", { message: "Add demo skill", treeSha: "newtree", parentSha: "headsha" });
    expect(client.updateRef).toHaveBeenCalledWith("octo", "demo", "main", "newcommit");
    expect(res).toEqual({ htmlUrl: "https://github.com/octo/demo", commitSha: "newcommit", skipped: [] });
  });

  it("retries getRef while auto_init's first commit lags, then succeeds", async () => {
    const getRef = vi
      .fn()
      .mockRejectedValueOnce(new GitHubError(409, "Git Repository is empty."))
      .mockResolvedValueOnce({ sha: "headsha" });
    const client = stubClient({ getRef });
    const res = await publishSkill(client, {
      target: { mode: "new-repo", name: "demo", isPrivate: true, description: "d" },
      files: FILES,
      dirName: "demo",
      message: "Add demo skill",
    });
    expect(getRef).toHaveBeenCalledTimes(2);
    expect(res.commitSha).toBe("newcommit");
  });
});

describe("publishSkill — existing repo", () => {
  it("commits under skills/<dirName> by default and reuses the repo default branch", async () => {
    const client = stubClient();
    const res = await publishSkill(client, {
      target: { mode: "existing", owner: "me", repo: "monorepo" },
      files: FILES,
      dirName: "demo",
      message: "Add demo skill",
    });
    expect(client.getDefaultBranch).toHaveBeenCalledWith("me", "monorepo");
    const treeEntries = (client.createTree as ReturnType<typeof vi.fn>).mock.calls[0][3];
    expect(treeEntries.map((e: { path: string }) => e.path).sort()).toEqual(["skills/demo/SKILL.md", "skills/demo/references/api.md"]);
    expect(client.getRef).toHaveBeenCalledWith("me", "monorepo", "main");
    expect(res.htmlUrl).toBe("https://github.com/me/monorepo");
  });

  it("honors an explicit branch and a custom path prefix, normalizing slashes", async () => {
    const client = stubClient();
    await publishSkill(client, {
      target: { mode: "existing", owner: "me", repo: "monorepo", branch: "dev", pathPrefix: "/plugins/demo/" },
      files: FILES,
      dirName: "demo",
      message: "m",
    });
    expect(client.getDefaultBranch).not.toHaveBeenCalled();
    expect(client.getRef).toHaveBeenCalledWith("me", "monorepo", "dev");
    const treeEntries = (client.createTree as ReturnType<typeof vi.fn>).mock.calls[0][3];
    expect(treeEntries.map((e: { path: string }) => e.path).sort()).toEqual(["plugins/demo/SKILL.md", "plugins/demo/references/api.md"]);
  });

  it("skips symlink files and reports them", async () => {
    const client = stubClient();
    const withLink: SkillFile[] = [...FILES, { path: "shared.md", content: "../other/shared.md", symlink: true }];
    const res = await publishSkill(client, {
      target: { mode: "existing", owner: "me", repo: "r", branch: "main" },
      files: withLink,
      dirName: "demo",
      message: "m",
    });
    expect(res.skipped).toEqual(["shared.md"]);
    expect((client.createBlob as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(2); // only the two real files
  });
});

describe("publishSkill — errors propagate", () => {
  it("propagates a token-missing GitHubError from the client", async () => {
    const client = stubClient({
      createRepo: vi.fn(async () => {
        throw new GitHubError(401, "a token with repo scope is required to publish");
      }),
    });
    await expect(
      publishSkill(client, { target: { mode: "new-repo", name: "x", isPrivate: false }, files: FILES, dirName: "x", message: "m" })
    ).rejects.toThrow(/token with repo scope/i);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run lib/github/publish.test.ts`
Expected: FAIL — "Cannot find module './publish'".

- [ ] **Step 4: Implement `publish.ts`**

```ts
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
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run lib/github/publish.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/github/fetchSkill.ts lib/github/publish.ts lib/github/publish.test.ts
git commit -m "feat(github): publishSkill orchestration for new and existing repos"
```

---

### Task 3: PublishDialog in the workspace

**Files:**
- Create: `components/workspace/PublishDialog.tsx`
- Test: `components/workspace/PublishDialog.test.tsx`
- Edit: `app/workspace/page.tsx` (header button + dialog mount)
- Edit: `app/workspace/page.test.tsx` (append a publish-gate test)

**Interfaces:**
- Consumes: `publishSkill` + `PublishTarget` (Task 2), `createClient`, `RateLimitError`/`NotFoundError`/`GitHubError` (Task 1), `parseGitHubUrl` (`lib/github/url`), `SkillFile`.
- Produces: `PublishDialog` — a controlled modal.

```ts
export interface PublishDialogProps {
  open: boolean;
  onClose: () => void;
  files: SkillFile[];
  dirName: string;
  /** injectable for tests; default to the real lib */
  publishFn?: typeof publishSkill;
  createClientFn?: typeof createClient;
}
```

- The PAT section reads/writes localStorage `skillsmith:gh-pat`, with the note "needs a token with `repo` scope — stored locally only".
- A mode radio: **new repo** (name input prefilled with `dirName`, `private` checkbox) | **existing** (owner/repo input parsed with `parseGitHubUrl` bare-shorthand, optional branch, path prefix defaulting `skills/<dirName>`).
- Commit message input, default `Add <dirName> skill`.
- States: `idle → publishing → done(link) | error`. `RateLimitError`/`NotFoundError`/`GitHubError` map to friendly text.

- [ ] **Step 1: Write the failing tests**

`components/workspace/PublishDialog.test.tsx`:
```ts
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PublishDialog } from "./PublishDialog";
import { GitHubError, NotFoundError } from "@/lib/github/client";
import type { SkillFile } from "@/lib/skill-lint";

const FILES: SkillFile[] = [{ path: "SKILL.md", content: "---\nname: demo\ndescription: x\n---\nbody" }];
const noopClient = vi.fn(() => ({}) as never);

beforeEach(() => localStorage.clear());

describe("PublishDialog", () => {
  it("renders nothing when closed", () => {
    const { container } = render(
      <PublishDialog open={false} onClose={() => {}} files={FILES} dirName="demo" publishFn={vi.fn()} createClientFn={noopClient} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("publishes a new repo and shows the returned repo link", async () => {
    const publishFn = vi.fn(async () => ({ htmlUrl: "https://github.com/octo/demo", commitSha: "abc", skipped: [] }));
    render(
      <PublishDialog open onClose={() => {}} files={FILES} dirName="demo" publishFn={publishFn} createClientFn={noopClient} />
    );
    fireEvent.change(screen.getByLabelText(/personal access token/i), { target: { value: "ghp_x" } });
    fireEvent.click(screen.getByRole("button", { name: /^publish$/i }));

    const link = (await screen.findByRole("link", { name: /github\.com\/octo\/demo/i })) as HTMLAnchorElement;
    expect(link.href).toContain("github.com/octo/demo");
    // Default target is a new repo prefilled with the dirName.
    expect(publishFn.mock.calls[0][1]).toMatchObject({ target: { mode: "new-repo", name: "demo" }, dirName: "demo" });
  });

  it("blocks publish with a friendly message when no token is entered", async () => {
    const publishFn = vi.fn();
    render(
      <PublishDialog open onClose={() => {}} files={FILES} dirName="demo" publishFn={publishFn} createClientFn={noopClient} />
    );
    fireEvent.click(screen.getByRole("button", { name: /^publish$/i }));
    expect(await screen.findByText(/token with repo scope is required/i)).toBeTruthy();
    expect(publishFn).not.toHaveBeenCalled();
  });

  it("shows a friendly error as text when the lib rejects (not-found)", async () => {
    const publishFn = vi.fn(async () => {
      throw new NotFoundError("repo not found or private — add a token for private repos");
    });
    render(
      <PublishDialog open onClose={() => {}} files={FILES} dirName="demo" publishFn={publishFn} createClientFn={noopClient} />
    );
    fireEvent.change(screen.getByLabelText(/personal access token/i), { target: { value: "ghp_x" } });
    fireEvent.click(screen.getByRole("button", { name: /^publish$/i }));
    expect(await screen.findByText(/repository not found/i)).toBeTruthy();
  });

  it("surfaces a 422 name-exists GitHubError message verbatim", async () => {
    const publishFn = vi.fn(async () => {
      throw new GitHubError(422, "name already exists on this account");
    });
    render(
      <PublishDialog open onClose={() => {}} files={FILES} dirName="demo" publishFn={publishFn} createClientFn={noopClient} />
    );
    fireEvent.change(screen.getByLabelText(/personal access token/i), { target: { value: "ghp_x" } });
    fireEvent.click(screen.getByRole("button", { name: /^publish$/i }));
    expect(await screen.findByText(/already exists/i)).toBeTruthy();
  });

  it("builds an existing-repo target from an owner/repo shorthand", async () => {
    const publishFn = vi.fn(async () => ({ htmlUrl: "https://github.com/me/mono", commitSha: "c", skipped: [] }));
    render(
      <PublishDialog open onClose={() => {}} files={FILES} dirName="demo" publishFn={publishFn} createClientFn={noopClient} />
    );
    fireEvent.change(screen.getByLabelText(/personal access token/i), { target: { value: "ghp_x" } });
    fireEvent.click(screen.getByLabelText(/existing repository/i));
    fireEvent.change(screen.getByLabelText(/owner\/repo/i), { target: { value: "me/mono" } });
    fireEvent.click(screen.getByRole("button", { name: /^publish$/i }));

    await screen.findByRole("link", { name: /github\.com\/me\/mono/i });
    expect(publishFn.mock.calls[0][1]).toMatchObject({
      target: { mode: "existing", owner: "me", repo: "mono", pathPrefix: "skills/demo" },
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run components/workspace/PublishDialog.test.tsx`
Expected: FAIL — "Cannot find module './PublishDialog'".

- [ ] **Step 3: Implement `PublishDialog.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import type { SkillFile } from "@/lib/skill-lint";
import { createClient, GitHubError, NotFoundError, RateLimitError } from "@/lib/github/client";
import { parseGitHubUrl } from "@/lib/github/url";
import { publishSkill, type PublishTarget } from "@/lib/github/publish";

const TOKEN_KEY = "skillsmith:gh-pat";

export interface PublishDialogProps {
  open: boolean;
  onClose: () => void;
  files: SkillFile[];
  dirName: string;
  publishFn?: typeof publishSkill;
  createClientFn?: typeof createClient;
}

type Mode = "new-repo" | "existing";
type State =
  | { s: "idle" }
  | { s: "publishing" }
  | { s: "done"; htmlUrl: string; skipped: string[] }
  | { s: "error"; message: string };

function friendlyError(e: unknown): string {
  if (e instanceof RateLimitError) return "GitHub rate limit reached — wait a moment or use a token with more quota.";
  if (e instanceof NotFoundError) return "Repository not found — check the owner/repo and that your token can access it.";
  if (e instanceof GitHubError) return e.message;
  return e instanceof Error ? e.message : "Something went wrong while publishing.";
}

export function PublishDialog({
  open,
  onClose,
  files,
  dirName,
  publishFn = publishSkill,
  createClientFn = createClient,
}: PublishDialogProps) {
  const [token, setToken] = useState("");
  const [mode, setMode] = useState<Mode>("new-repo");
  const [repoName, setRepoName] = useState(dirName);
  const [isPrivate, setIsPrivate] = useState(false);
  const [ownerRepo, setOwnerRepo] = useState("");
  const [branch, setBranch] = useState("");
  const [pathPrefix, setPathPrefix] = useState(`skills/${dirName}`);
  const [message, setMessage] = useState(`Add ${dirName} skill`);
  const [state, setState] = useState<State>({ s: "idle" });

  // Token lives only in localStorage, read/written in the UI layer.
  useEffect(() => {
    try {
      setToken(localStorage.getItem(TOKEN_KEY) ?? "");
    } catch {
      /* storage blocked — in-memory only */
    }
  }, []);

  function updateToken(t: string) {
    setToken(t);
    try {
      if (t) localStorage.setItem(TOKEN_KEY, t);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignore quota/security errors */
    }
  }

  if (!open) return null;

  function buildTarget(): PublishTarget | { error: string } {
    if (mode === "new-repo") {
      const name = repoName.trim();
      if (!name) return { error: "Enter a name for the new repository." };
      return { mode: "new-repo", name, isPrivate };
    }
    const parsed = parseGitHubUrl(ownerRepo.trim());
    if (!parsed || parsed.kind !== "repo") {
      return { error: "Enter the target as owner/repo or a GitHub repository URL." };
    }
    return {
      mode: "existing",
      owner: parsed.owner,
      repo: parsed.repo,
      branch: branch.trim() || undefined,
      pathPrefix: pathPrefix.trim() || undefined,
    };
  }

  async function onPublish() {
    const target = buildTarget();
    if ("error" in target) {
      setState({ s: "error", message: target.error });
      return;
    }
    if (!token.trim()) {
      setState({ s: "error", message: "A token with repo scope is required to publish." });
      return;
    }
    setState({ s: "publishing" });
    try {
      const client = createClientFn({ token: token.trim(), fetchFn: fetch });
      const res = await publishFn(client, {
        target,
        files,
        dirName,
        message: message.trim() || `Add ${dirName} skill`,
      });
      setState({ s: "done", htmlUrl: res.htmlUrl, skipped: res.skipped });
    } catch (e) {
      setState({ s: "error", message: friendlyError(e) });
    }
  }

  const publishing = state.s === "publishing";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label="Publish to GitHub">
      <div className="w-full max-w-lg rounded-lg border border-neutral-700 bg-neutral-900 p-5 text-neutral-100">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Publish to GitHub</h2>
          <button type="button" onClick={onClose} className="text-neutral-400 hover:text-neutral-200">
            Close
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-1">
          <label htmlFor="pub-token" className="text-sm text-neutral-300">
            Personal access token
          </label>
          <input
            id="pub-token"
            type="password"
            value={token}
            onChange={(e) => updateToken(e.target.value)}
            placeholder="ghp_…"
            autoComplete="off"
            className="rounded border border-neutral-700 bg-neutral-800 px-2 py-1 text-sm"
          />
          <span className="text-xs text-neutral-500">Needs a token with repo scope — stored locally only, never sent anywhere but github.com.</span>
        </div>

        <fieldset className="mt-4">
          <legend className="text-sm text-neutral-300">Destination</legend>
          <label className="mt-1 flex items-center gap-2 text-sm">
            <input type="radio" name="pub-mode" checked={mode === "new-repo"} onChange={() => setMode("new-repo")} />
            New repository
          </label>
          <label className="mt-1 flex items-center gap-2 text-sm">
            <input type="radio" name="pub-mode" aria-label="Existing repository" checked={mode === "existing"} onChange={() => setMode("existing")} />
            Existing repository
          </label>
        </fieldset>

        {mode === "new-repo" ? (
          <div className="mt-3 flex flex-col gap-2">
            <label htmlFor="pub-name" className="text-sm text-neutral-300">Repository name</label>
            <input
              id="pub-name"
              value={repoName}
              onChange={(e) => setRepoName(e.target.value)}
              className="rounded border border-neutral-700 bg-neutral-800 px-2 py-1 text-sm"
            />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} />
              Private repository
            </label>
          </div>
        ) : (
          <div className="mt-3 flex flex-col gap-2">
            <label htmlFor="pub-repo" className="text-sm text-neutral-300">owner/repo</label>
            <input
              id="pub-repo"
              value={ownerRepo}
              onChange={(e) => setOwnerRepo(e.target.value)}
              placeholder="me/my-monorepo"
              className="rounded border border-neutral-700 bg-neutral-800 px-2 py-1 text-sm"
            />
            <label htmlFor="pub-branch" className="text-sm text-neutral-300">Branch (optional — defaults to the repo default)</label>
            <input
              id="pub-branch"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              placeholder="main"
              className="rounded border border-neutral-700 bg-neutral-800 px-2 py-1 text-sm"
            />
            <label htmlFor="pub-prefix" className="text-sm text-neutral-300">Path prefix</label>
            <input
              id="pub-prefix"
              value={pathPrefix}
              onChange={(e) => setPathPrefix(e.target.value)}
              className="rounded border border-neutral-700 bg-neutral-800 px-2 py-1 text-sm"
            />
          </div>
        )}

        <div className="mt-3 flex flex-col gap-1">
          <label htmlFor="pub-message" className="text-sm text-neutral-300">Commit message</label>
          <input
            id="pub-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="rounded border border-neutral-700 bg-neutral-800 px-2 py-1 text-sm"
          />
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={onPublish}
            disabled={publishing}
            className="rounded-md border border-sky-600 bg-sky-600 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {publishing ? "Publishing…" : "Publish"}
          </button>
          {publishing && <span className="text-sm text-neutral-400">Creating commit…</span>}
        </div>

        {state.s === "error" && (
          <p className="mt-3 rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">{state.message}</p>
        )}
        {state.s === "done" && (
          <div className="mt-3 rounded border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
            <p>
              Published to{" "}
              <a href={state.htmlUrl} target="_blank" rel="noreferrer" className="underline">
                {state.htmlUrl.replace(/^https?:\/\//, "")}
              </a>
              .
            </p>
            {state.skipped.length > 0 && (
              <p className="mt-1 text-emerald-300/80">Skipped {state.skipped.length} symlink file(s): {state.skipped.join(", ")}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run components/workspace/PublishDialog.test.tsx`
Expected: PASS.

- [ ] **Step 5: Wire the button into `app/workspace/page.tsx`**

Add the import near the other workspace imports:
```tsx
import { PublishDialog } from "@/components/workspace/PublishDialog";
```

Add state next to the other `useState` hooks in `WorkspacePage`:
```tsx
  const [showPublish, setShowPublish] = useState(false);
```

Add the publish target dir next to `skillName`:
```tsx
  const publishDir = ((state.dirName || skillName || "skill").trim() || "skill");
```

Replace the header's `ml-auto` block so the Publish button sits next to `ExportButtons`:
```tsx
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowPublish(true)}
            disabled={hasError}
            title={hasError ? "Fix every error before publishing" : undefined}
            className={`rounded-md border px-3 py-1.5 text-sm font-medium ${
              hasError
                ? "cursor-not-allowed border-neutral-800 bg-neutral-900 text-neutral-600"
                : "border-neutral-700 bg-neutral-800 text-neutral-100 hover:bg-neutral-700"
            }`}
          >
            Publish to GitHub
          </button>
          <ExportButtons files={state.files} dirName={state.dirName} skillName={skillName} hasError={hasError} />
        </div>
```

Mount the dialog just before the final closing `</div>` of the page (after the grid/not-a-skill block):
```tsx
      <PublishDialog
        open={showPublish}
        onClose={() => setShowPublish(false)}
        files={state.files}
        dirName={publishDir}
      />
```

- [ ] **Step 6: Append a gate test to `app/workspace/page.test.tsx`**

```ts
  it("gates Publish to GitHub behind the same error gate as export", () => {
    render(<WorkspacePage />);
    // Demo is valid → publish enabled.
    expect((screen.getByRole("button", { name: "Publish to GitHub" }) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Open…" }));
    const paste = screen.getByLabelText("Paste a SKILL.md");
    fireEvent.change(paste, { target: { value: "# just markdown" } });
    fireEvent.click(screen.getByRole("button", { name: "Analyze" }));
    // Not-a-skill → publish disabled.
    expect((screen.getByRole("button", { name: "Publish to GitHub" }) as HTMLButtonElement).disabled).toBe(true);
  });
```

- [ ] **Step 7: Run the workspace tests**

Run: `npx vitest run components/workspace/PublishDialog.test.tsx app/workspace/page.test.tsx`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add components/workspace/PublishDialog.tsx components/workspace/PublishDialog.test.tsx app/workspace/page.tsx app/workspace/page.test.tsx
git commit -m "feat(workspace): Publish to GitHub dialog wired behind the error gate"
```

---

### Task 4: Bulk download in `/import`

**Files:**
- Edit: `lib/zip.ts` (add `zipCollection`)
- Test: `lib/zip.test.ts` (append `zipCollection` tests)
- Create: `lib/github/bulkFetch.ts`
- Test: `lib/github/bulkFetch.test.ts`
- Edit: `components/import/ImportApp.tsx` (Download-all button + progress + Open disable)
- Test: `components/import/ImportApp.test.tsx` (append bulk tests)

**Interfaces:**
- `lib/zip.ts` adds:
```ts
export function zipCollection(groups: { name: string; files: SkillFile[] }[]): Uint8Array;
```
> **Ambiguity resolved:** the brief offered "add `zipCollection` to `lib/zip.ts`" vs. a `buildCollectionZip` in `bulkFetch`. Per the parenthetical "choose: add `zipCollection`", the zip builder lives in `lib/zip.ts` and `bulkFetch` does not re-wrap it; `ImportApp` calls `zipCollection` directly.

- `lib/github/bulkFetch.ts` produces:
```ts
export interface CollectionZip { name: string; files: SkillFile[]; }
export interface BulkResult { zips: CollectionZip[]; skipped: string[]; }

export function fetchAllSkills(
  client: GitHubClient,
  owner: string,
  repo: string,
  ref: string,
  skills: DetectedSkillRef[],
  entries: TreeEntry[],
  onStep?: (step: string) => void
): Promise<BulkResult>;
```
Skills run **sequentially** (`fetchSkillFiles` already fans out 4-wide internally, so an outer loop bounds total concurrency at 4). `onStep("Fetching skill i/N: name")` per skill. Collision-free names via `-2`, `-3`… suffixes. `RateLimitError` propagates (aborts the batch).

- [ ] **Step 1: Write the failing `zipCollection` tests** — append to `lib/zip.test.ts`

```ts
import { zipCollection } from "./zip";

describe("zipCollection", () => {
  it("nests each group under skills/<name>/ and round-trips via unzipSkill-free reading", () => {
    const bytes = zipCollection([
      { name: "alpha", files: [{ path: "SKILL.md", content: "a" }, { path: "references/x.md", content: "ax" }] },
      { name: "beta", files: [{ path: "SKILL.md", content: "b" }] },
    ]);
    expect(bytes).toBeInstanceOf(Uint8Array);
    // Re-read with fflate to assert the entry layout.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { unzipSync, strFromU8 } = require("fflate") as typeof import("fflate");
    const raw = unzipSync(bytes);
    const keys = Object.keys(raw).sort();
    expect(keys).toEqual(["skills/alpha/SKILL.md", "skills/alpha/references/x.md", "skills/beta/SKILL.md"]);
    expect(strFromU8(raw["skills/alpha/references/x.md"])).toBe("ax");
  });
});
```

- [ ] **Step 2: Implement `zipCollection`** — add to `lib/zip.ts`

```ts
/** Bundle multiple skills into one archive: each group nests under `skills/<name>/`. */
export function zipCollection(groups: { name: string; files: SkillFile[] }[]): Uint8Array {
  const entries: Record<string, Uint8Array> = {};
  for (const g of groups) {
    for (const f of g.files) {
      entries[`skills/${g.name}/${f.path}`] = strToU8(f.content);
    }
  }
  return zipSync(entries, { level: 6 });
}
```

- [ ] **Step 3: Write the failing `bulkFetch` tests**

`lib/github/bulkFetch.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { fetchAllSkills } from "./bulkFetch";
import { RateLimitError, type GitHubClient, type TreeEntry } from "./client";
import type { DetectedSkillRef } from "./detect";

const SKILL_MD = "---\nname: x\ndescription: y\n---\nbody";

function entriesFor(dirs: string[]): TreeEntry[] {
  return dirs.map((d) => ({ path: `${d}/SKILL.md`, mode: "100644", type: "blob" as const, sha: `sha-${d}` }));
}

function refFor(dirPath: string, name: string): DetectedSkillRef {
  return { dirPath, name, origin: "skills-dir", viaSymlink: false };
}

function client(getBlobText: GitHubClient["getBlobText"]): GitHubClient {
  return {
    getRepoTree: async () => ({ entries: [], truncated: false }),
    getBlobText,
    getReadme: async () => "",
    getGistFiles: async () => [],
  } as unknown as GitHubClient;
}

describe("fetchAllSkills", () => {
  it("fetches skills sequentially and reports progress i/N", async () => {
    const steps: string[] = [];
    const entries = entriesFor(["skills/a", "skills/b"]);
    const c = client(async () => SKILL_MD);
    const res = await fetchAllSkills(
      c,
      "o",
      "r",
      "main",
      [refFor("skills/a", "a"), refFor("skills/b", "b")],
      entries,
      (s) => steps.push(s)
    );
    expect(res.zips.map((z) => z.name)).toEqual(["a", "b"]);
    expect(steps).toEqual(["Fetching skill 1/2: a", "Fetching skill 2/2: b"]);
  });

  it("dedupes colliding folder names with -2, -3 suffixes", async () => {
    // Two flat skills whose dirName basename is the same ("helper").
    const entries = entriesFor(["one/helper", "two/helper"]);
    const c = client(async () => SKILL_MD);
    const res = await fetchAllSkills(
      c,
      "o",
      "r",
      "main",
      [refFor("one/helper", "helper"), refFor("two/helper", "helper")],
      entries
    );
    expect(res.zips.map((z) => z.name)).toEqual(["helper", "helper-2"]);
  });

  it("propagates a RateLimitError and aborts the batch", async () => {
    const entries = entriesFor(["skills/a", "skills/b"]);
    const c = client(async () => {
      throw new RateLimitError(1700000000);
    });
    await expect(
      fetchAllSkills(c, "o", "r", "main", [refFor("skills/a", "a"), refFor("skills/b", "b")], entries)
    ).rejects.toBeInstanceOf(RateLimitError);
  });
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `npx vitest run lib/zip.test.ts lib/github/bulkFetch.test.ts`
Expected: FAIL — `zipCollection` missing / "Cannot find module './bulkFetch'".

- [ ] **Step 5: Implement `bulkFetch.ts`**

```ts
import type { SkillFile } from "@/lib/skill-lint";
import { RateLimitError, type GitHubClient, type TreeEntry } from "./client";
import type { DetectedSkillRef } from "./detect";
import { fetchSkillFiles } from "./fetchSkill";

export interface CollectionZip {
  name: string;
  files: SkillFile[];
}

export interface BulkResult {
  zips: CollectionZip[];
  skipped: string[];
}

/**
 * Fetch every detected skill's files. `fetchSkillFiles` already fans out 4-wide
 * per skill, so we walk skills SEQUENTIALLY to keep total concurrency at 4.
 * A RateLimitError aborts the whole batch (re-thrown).
 */
export async function fetchAllSkills(
  client: GitHubClient,
  owner: string,
  repo: string,
  ref: string,
  skills: DetectedSkillRef[],
  entries: TreeEntry[],
  onStep: (step: string) => void = () => {}
): Promise<BulkResult> {
  const zips: CollectionZip[] = [];
  const skipped: string[] = [];
  const used = new Set<string>();

  for (let i = 0; i < skills.length; i++) {
    const ref0 = skills[i];
    onStep(`Fetching skill ${i + 1}/${skills.length}: ${ref0.name}`);

    let fetched: Awaited<ReturnType<typeof fetchSkillFiles>>;
    try {
      fetched = await fetchSkillFiles(client, owner, repo, ref, ref0, entries);
    } catch (e) {
      if (e instanceof RateLimitError) throw e;
      skipped.push(`${ref0.name}: failed to fetch`);
      continue;
    }

    if (fetched.files.length === 0) {
      skipped.push(`${ref0.name}: no files found`);
      continue;
    }

    // Dedupe collisions with -2, -3 … suffixes.
    const base = fetched.dirName || ref0.name;
    let name = base;
    let n = 2;
    while (used.has(name)) name = `${base}-${n++}`;
    used.add(name);

    zips.push({ name, files: fetched.files });
    for (const s of fetched.skipped) skipped.push(`${name}/${s.path}: ${s.reason}`);
  }

  return { zips, skipped };
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run lib/zip.test.ts lib/github/bulkFetch.test.ts`
Expected: PASS.

- [ ] **Step 7: Wire the "Download all" button into `components/import/ImportApp.tsx`**

Add imports:
```tsx
import { fetchAllSkills } from "@/lib/github/bulkFetch";
import { downloadBlob, zipCollection } from "@/lib/zip";
```

Add state next to the other hooks:
```tsx
  const [bulk, setBulk] = useState<{ running: boolean; step: string }>({ running: false, step: "" });
```

Add the handler near `openSkill` (uses the `"__bulk__"` sentinel so every row's Open button — which disables on `busyDir !== null` — greys out during the batch):
```tsx
  async function downloadAll(result: Extract<ImportResult, { mode: "picker" }>) {
    setBusyDir("__bulk__");
    setBulk({ running: true, step: "Preparing…" });
    try {
      const refs = result.skills.map((s) => s.ref);
      const { zips } = await fetchAllSkills(
        makeClient(),
        result.owner,
        result.repo,
        result.ref,
        refs,
        result.entries,
        (step) => setBulk({ running: true, step })
      );
      downloadBlob(`${result.repo}-skills.zip`, zipCollection(zips), "application/zip");
    } catch (error) {
      setView({ s: "error", error });
    } finally {
      setBulk({ running: false, step: "" });
      setBusyDir(null);
    }
  }
```

Inside the `mode === "picker"` block, add the button + progress line above `<SkillPicker … />` (visible only with ≥2 skills):
```tsx
            {view.result.skills.length >= 2 && (
              <div className="mb-2 flex items-center gap-3">
                <button
                  type="button"
                  disabled={bulk.running}
                  onClick={() => view.result.mode === "picker" && downloadAll(view.result)}
                  className="rounded bg-blue-600 px-3 py-1 text-sm text-white disabled:opacity-50"
                >
                  {bulk.running ? "Downloading…" : "Download all (.zip)"}
                </button>
                {bulk.running && <span className="text-sm text-gray-600">{bulk.step}</span>}
              </div>
            )}
```

- [ ] **Step 8: Append bulk tests to `components/import/ImportApp.test.tsx`**

At the top of the file, mock `@/lib/zip` so the download does not touch jsdom's absent `URL.createObjectURL`:
```ts
const downloadBlob = vi.fn();
const zipCollection = vi.fn(() => new Uint8Array([1, 2, 3]));
vi.mock("@/lib/zip", () => ({
  downloadBlob: (...a: unknown[]) => downloadBlob(...a),
  zipCollection: (...a: unknown[]) => zipCollection(...a),
}));
```

Add a two-skill client and tests inside the existing `describe("ImportApp", …)` block:
```ts
  function twoSkillClient(): GitHubClient {
    return {
      getRepoTree: async () => ({
        entries: [
          { path: "skills/alpha/SKILL.md", mode: "100644", type: "blob", sha: "a" },
          { path: "skills/beta/SKILL.md", mode: "100644", type: "blob", sha: "b" },
        ],
        truncated: false,
      }),
      getBlobText: async () => SKILL_MD,
      getReadme: async () => "",
      getGistFiles: async () => [],
    };
  }

  it("shows Download all only with ≥2 skills and bundles them into one zip", async () => {
    downloadBlob.mockClear();
    render(<ImportApp createClientFn={() => twoSkillClient()} />);
    fireEvent.change(screen.getByLabelText(/repository url/i), { target: { value: "github.com/o/r" } });
    fireEvent.click(screen.getByRole("button", { name: /^import$/i }));

    const dl = await screen.findByRole("button", { name: /download all/i });
    fireEvent.click(dl);

    await vi.waitFor(() => expect(downloadBlob).toHaveBeenCalledTimes(1));
    expect(downloadBlob.mock.calls[0][0]).toBe("r-skills.zip");
    expect(downloadBlob.mock.calls[0][2]).toBe("application/zip");
  });
```

(The single-skill picker path already exercised by earlier tests must NOT render "Download all" — the `>= 2` guard covers that; no extra assertion needed, but you may add `expect(screen.queryByRole("button", { name: /download all/i })).toBeNull()` to the existing single-skill test.)

- [ ] **Step 9: Run the import tests**

Run: `npx vitest run components/import/ImportApp.test.tsx lib/github/bulkFetch.test.ts lib/zip.test.ts`
Expected: PASS.

- [ ] **Step 10: Full suite + static export build (final wiring gate)**

Run: `npm test`
Expected: all suites PASS (engine, rules, workspace, wizard, import, github — including the new client/publish/bulk/dialog tests).

Run: `npm run build`
Expected: static export succeeds.

Run: `ls out/workspace/index.html out/import/index.html out/index.html`
Expected: all three exist (the workspace publish button and the import bulk button ship in the static bundle).

- [ ] **Step 11: Commit**

```bash
git add lib/zip.ts lib/zip.test.ts lib/github/bulkFetch.ts lib/github/bulkFetch.test.ts components/import/ImportApp.tsx components/import/ImportApp.test.tsx
git commit -m "feat(import): bulk-download all detected skills as one .zip"
```

---

## Done criteria

- Workspace header has **Publish to GitHub**, gated identically to export; it publishes to a new `auto_init` repo (files at root) or an existing repo under `skills/<dirName>` (or a custom prefix), skipping symlinks, using the localStorage PAT — all client-side against `api.github.com`.
- `/import` picker shows **Download all (.zip)** with ≥2 skills, streaming progress, bundling every detected skill under `skills/<name>/` into `<repo>-skills.zip`, disabling row Opens while running, surfacing rate limits via `ErrorPanel`.
- `lib/github/*` stayed pure/injectable; every UI test mocked the lib, every lib test mocked the client object; `fetch` was mocked only in `client.test.ts`.
- `npm test` and `npm run build` both pass; static export intact.
