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

  it("discloses that files at the path prefix will be overwritten in existing-repo mode", () => {
    render(
      <PublishDialog open onClose={() => {}} files={FILES} dirName="demo" publishFn={vi.fn()} createClientFn={noopClient} />
    );
    fireEvent.click(screen.getByLabelText(/existing repository/i));
    expect(screen.getByText(/files already at this path will be replaced by this commit/i)).toBeTruthy();
  });

  it("autocompletes owner/repo from a datalist populated by the signed-in user's repos, and publishes the picked repo", async () => {
    localStorage.setItem("skillsmith:gh-pat", "ghp_x");
    const publishFn = vi.fn(async () => ({ htmlUrl: "https://github.com/octocat/skills", commitSha: "c", skipped: [] }));
    const createClientFn = vi.fn(
      () =>
        ({
          getUser: async () => ({ login: "octocat" }),
          listUserRepos: async () => [
            { owner: "octocat", repo: "skills", isPrivate: false, defaultBranch: "main", description: "" },
            { owner: "octocat", repo: "notes", isPrivate: true, defaultBranch: "main", description: "" },
          ],
        }) as never
    );
    render(
      <PublishDialog open onClose={() => {}} files={FILES} dirName="demo" publishFn={publishFn} createClientFn={createClientFn} />
    );
    fireEvent.click(screen.getByLabelText(/existing repository/i));

    await vi.waitFor(() => {
      const options = Array.from(document.querySelectorAll("#pub-repo-options option")) as HTMLOptionElement[];
      expect(options.map((o) => o.value)).toEqual(["octocat/skills", "octocat/notes"]);
    });

    const input = screen.getByLabelText(/owner\/repo/i);
    fireEvent.change(input, { target: { value: "octocat/skills" } });
    fireEvent.click(screen.getByRole("button", { name: /^publish$/i }));

    await screen.findByRole("link", { name: /github\.com\/octocat\/skills/i });
    expect(publishFn.mock.calls[0][1]).toMatchObject({ target: { mode: "existing", owner: "octocat", repo: "skills" } });
  });

  it("shows a will-create hint with the signed-in login in new-repo mode", async () => {
    localStorage.setItem("skillsmith:gh-pat", "ghp_x");
    const createClientFn = vi.fn(
      () =>
        ({
          getUser: async () => ({ login: "octocat" }),
          listUserRepos: async () => [],
        }) as never
    );
    render(
      <PublishDialog open onClose={() => {}} files={FILES} dirName="demo" publishFn={vi.fn()} createClientFn={createClientFn} />
    );
    expect(await screen.findByText(/will create github\.com\/octocat\/demo/i)).toBeTruthy();
  });
});
