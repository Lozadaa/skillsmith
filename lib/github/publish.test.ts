import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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

  describe("getRef retry (fake timers)", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("retries getRef while auto_init's first commit lags, then succeeds", async () => {
      const getRef = vi
        .fn()
        .mockRejectedValueOnce(new GitHubError(409, "Git Repository is empty."))
        .mockResolvedValueOnce({ sha: "headsha" });
      const client = stubClient({ getRef });
      const resPromise = publishSkill(client, {
        target: { mode: "new-repo", name: "demo", isPrivate: true, description: "d" },
        files: FILES,
        dirName: "demo",
        message: "Add demo skill",
      });
      await vi.advanceTimersByTimeAsync(800);
      const res = await resPromise;
      expect(getRef).toHaveBeenCalledTimes(2);
      expect(res.commitSha).toBe("newcommit");
    });

    it("rejects with the underlying error after exhausting all retries", async () => {
      const err = new GitHubError(409, "Git Repository is empty.");
      const getRef = vi.fn().mockRejectedValue(err);
      const client = stubClient({ getRef });
      const resPromise = publishSkill(client, {
        target: { mode: "new-repo", name: "demo", isPrivate: true, description: "d" },
        files: FILES,
        dirName: "demo",
        message: "Add demo skill",
      });
      // Swallow the eventual rejection until we assert on it below, so Vitest
      // doesn't see it as an unhandled rejection while timers advance.
      const assertion = expect(resPromise).rejects.toBe(err);
      await vi.advanceTimersByTimeAsync(800);
      await vi.advanceTimersByTimeAsync(800);
      await assertion;
      expect(getRef).toHaveBeenCalledTimes(3);
    });
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

  it("joins paths with no leading slash when pathPrefix normalizes to empty (\"/\")", async () => {
    const client = stubClient();
    await publishSkill(client, {
      target: { mode: "existing", owner: "me", repo: "monorepo", branch: "main", pathPrefix: "/" },
      files: FILES,
      dirName: "demo",
      message: "m",
    });
    const treeEntries = (client.createTree as ReturnType<typeof vi.fn>).mock.calls[0][3];
    const paths = treeEntries.map((e: { path: string }) => e.path);
    expect(paths.every((p: string) => !p.startsWith("/"))).toBe(true);
    expect(paths.sort()).toEqual(["SKILL.md", "references/api.md"]);
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
