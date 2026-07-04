// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ImportApp from "./ImportApp";
import { NotFoundError, RateLimitError, type GitHubClient } from "@/lib/github/client";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
const stash = vi.fn();
vi.mock("@/lib/handoff", () => ({ stashIncomingSkill: (...a: unknown[]) => stash(...a) }));
const downloadBlob = vi.fn();
const zipCollection = vi.fn(() => new Uint8Array([1, 2, 3]));
vi.mock("@/lib/zip", () => ({
  downloadBlob: (...a: unknown[]) => downloadBlob(...a),
  zipCollection: (...a: unknown[]) => zipCollection(...a),
}));

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

  it("disables every Open button while any row's fetch is in flight", async () => {
    let resolveBlob: (v: string) => void = () => {};
    let aCalls = 0;
    const slowClient: GitHubClient = {
      getRepoTree: async () => ({
        entries: [
          { path: "skills/alpha/SKILL.md", mode: "100644", type: "blob", sha: "a" },
          { path: "skills/beta/SKILL.md", mode: "100644", type: "blob", sha: "b" },
        ],
        truncated: false,
      }),
      getBlobText: (_o, _r, sha) => {
        // First call per sha is the picker's mini-lint scan; only the *second*
        // call for "a" (the openSkill fetch) hangs, so we can observe the
        // in-flight disabled state without deadlocking the initial scan.
        if (sha === "a") {
          aCalls++;
          if (aCalls > 1) return new Promise((resolve) => (resolveBlob = resolve));
        }
        return Promise.resolve(SKILL_MD);
      },
      getReadme: async () => "",
      getGistFiles: async () => [],
    };
    render(<ImportApp createClientFn={() => slowClient} />);
    fireEvent.change(screen.getByLabelText(/repository url/i), { target: { value: "github.com/o/r" } });
    fireEvent.click(screen.getByRole("button", { name: /^import$/i }));

    const openButtons = await screen.findAllByRole("button", { name: /^open|opening/i });
    expect(openButtons).toHaveLength(2);
    fireEvent.click(openButtons[0]);

    await vi.waitFor(() => {
      const buttons = screen.getAllByRole("button", { name: /^open|opening/i });
      expect(buttons.every((b) => (b as HTMLButtonElement).disabled)).toBe(true);
    });

    resolveBlob(SKILL_MD);
    await vi.waitFor(() => expect(stash).toHaveBeenCalledTimes(1));
  });

  it("opens the token field when the rate-limit CTA is clicked", async () => {
    const rateLimitedClient: GitHubClient = {
      getRepoTree: async () => {
        throw new RateLimitError(1700000000);
      },
      getBlobText: async () => SKILL_MD,
      getReadme: async () => "",
      getGistFiles: async () => [],
    };
    render(<ImportApp createClientFn={() => rateLimitedClient} />);
    fireEvent.change(screen.getByLabelText(/repository url/i), { target: { value: "github.com/o/r" } });
    fireEvent.click(screen.getByRole("button", { name: /^import$/i }));

    const cta = await screen.findByRole("button", { name: /add a token/i });
    expect(screen.queryByLabelText(/personal access token/i)).toBeNull();

    fireEvent.click(cta);

    expect(await screen.findByLabelText(/personal access token/i)).toBeTruthy();
  });

  it("shows the add-a-token CTA for a not-found (likely private) repo", async () => {
    const notFoundClient: GitHubClient = {
      getRepoTree: async () => {
        throw new NotFoundError("repo not found or private — add a token for private repos");
      },
      getBlobText: async () => SKILL_MD,
      getReadme: async () => "",
      getGistFiles: async () => [],
    };
    render(<ImportApp createClientFn={() => notFoundClient} />);
    fireEvent.change(screen.getByLabelText(/repository url/i), { target: { value: "github.com/o/r" } });
    fireEvent.click(screen.getByRole("button", { name: /^import$/i }));

    const cta = await screen.findByRole("button", { name: /add a token/i });
    fireEvent.click(cta);
    expect(await screen.findByLabelText(/personal access token/i)).toBeTruthy();
  });

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

  it("disables Download all while a single row's Open fetch is in flight", async () => {
    let resolveBlob: (v: string) => void = () => {};
    let aCalls = 0;
    const slowClient: GitHubClient = {
      getRepoTree: async () => ({
        entries: [
          { path: "skills/alpha/SKILL.md", mode: "100644", type: "blob", sha: "a" },
          { path: "skills/beta/SKILL.md", mode: "100644", type: "blob", sha: "b" },
        ],
        truncated: false,
      }),
      getBlobText: (_o, _r, sha) => {
        // First call per sha is the picker's mini-lint scan; only the *second*
        // call for "a" (the openSkill fetch) hangs, mirroring the existing
        // "disables every Open button" test above.
        if (sha === "a") {
          aCalls++;
          if (aCalls > 1) return new Promise((resolve) => (resolveBlob = resolve));
        }
        return Promise.resolve(SKILL_MD);
      },
      getReadme: async () => "",
      getGistFiles: async () => [],
    };
    render(<ImportApp createClientFn={() => slowClient} />);
    fireEvent.change(screen.getByLabelText(/repository url/i), { target: { value: "github.com/o/r" } });
    fireEvent.click(screen.getByRole("button", { name: /^import$/i }));

    const openButtons = await screen.findAllByRole("button", { name: /^open|opening/i });
    fireEvent.click(openButtons[0]);

    await vi.waitFor(() => {
      const dl = screen.getByRole("button", { name: /download all/i }) as HTMLButtonElement;
      expect(dl.disabled).toBe(true);
    });

    resolveBlob(SKILL_MD);
    await vi.waitFor(() => expect(stash).toHaveBeenCalledTimes(1));
  });

  it("shows a completion note listing skipped items after a bulk download", async () => {
    downloadBlob.mockClear();
    const clientWithOversizedBeta: GitHubClient = {
      getRepoTree: async () => ({
        entries: [
          { path: "skills/alpha/SKILL.md", mode: "100644", type: "blob", sha: "a" },
          { path: "skills/beta/SKILL.md", mode: "100644", type: "blob", sha: "b", size: 3 * 1024 * 1024 },
        ],
        truncated: false,
      }),
      getBlobText: async () => SKILL_MD,
      getReadme: async () => "",
      getGistFiles: async () => [],
    };
    render(<ImportApp createClientFn={() => clientWithOversizedBeta} />);
    fireEvent.change(screen.getByLabelText(/repository url/i), { target: { value: "github.com/o/r" } });
    fireEvent.click(screen.getByRole("button", { name: /^import$/i }));

    const dl = await screen.findByRole("button", { name: /download all/i });
    fireEvent.click(dl);

    await vi.waitFor(() => expect(downloadBlob).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/1 skills? downloaded, 1 item\(s\) skipped/i)).toBeTruthy();
  });
});
