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
