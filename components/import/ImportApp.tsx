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
import CollectionAudit from "./CollectionAudit";
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
  const [tokenOpen, setTokenOpen] = useState(false);

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
        <TokenField token={token} onChange={updateToken} open={tokenOpen} onToggle={setTokenOpen} />
      </form>

      <section className="mt-6">
        {view.s === "loading" && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" aria-hidden />
            <span>{view.step}</span>
          </div>
        )}

        {view.s === "error" && (
          <ErrorPanel
            error={view.error}
            onNeedToken={() => {
              setTokenOpen(true);
              requestAnimationFrame(() => document.getElementById("gh-token")?.focus());
            }}
          />
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
            {view.result.skills.length > 3 && <CollectionAudit skills={view.result.skills} />}
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
