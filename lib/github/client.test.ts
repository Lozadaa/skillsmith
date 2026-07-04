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
