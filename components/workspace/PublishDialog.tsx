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
