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

  it("getRef encodes a nested branch name segment-wise, keeping literal slashes", async () => {
    let seenUrl = "";
    const fetchFn = (async (url: string | URL) => {
      seenUrl = String(url);
      return new Response(JSON.stringify({ object: { sha: "headsha" } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as unknown as typeof fetch;
    const client = createClient({ token: "t", fetchFn });
    await client.getRef("o", "r", "release/2.0");
    expect(seenUrl).toContain("/repos/o/r/git/ref/heads/release/2.0");
    expect(seenUrl).not.toContain("%2F");
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

  it("updateRef encodes a nested branch name segment-wise, keeping literal slashes", async () => {
    let seenUrl = "";
    const fetchFn = (async (url: string | URL) => {
      seenUrl = String(url);
      return new Response(JSON.stringify({ ref: "refs/heads/release/2.0", object: { sha: "commitsha" } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as unknown as typeof fetch;
    await createClient({ token: "t", fetchFn }).updateRef("o", "r", "release/2.0", "commitsha");
    expect(seenUrl).toContain("/repos/o/r/git/refs/heads/release/2.0");
    expect(seenUrl).not.toContain("%2F");
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
