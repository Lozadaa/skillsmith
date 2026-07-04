"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { stashIncomingSkill } from "@/lib/handoff";
import { createClient, GitHubError, type GitHubClient, type UserRepo } from "@/lib/github/client";
import { parseGitHubUrl } from "@/lib/github/url";
import { resolveTarget, type ImportResult, type PickerSkill } from "@/lib/github/importFlow";
import { fetchSkillFiles } from "@/lib/github/fetchSkill";
import { fetchAllSkills } from "@/lib/github/bulkFetch";
import { downloadBlob, zipCollection } from "@/lib/zip";
import type { RepoLink } from "@/lib/github/links";
import TokenField from "./TokenField";
import CollectionAudit from "./CollectionAudit";
import SkillPicker from "./SkillPicker";
import LinksList from "./LinksList";
import UserRepos from "./UserRepos";
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
  const [bulk, setBulk] = useState<{ running: boolean; step: string }>({ running: false, step: "" });
  const [me, setMe] = useState<{ login: string } | null>(null);
  const [repos, setRepos] = useState<UserRepo[]>([]);
  const [repoBusy, setRepoBusy] = useState(false);

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

  // A token unlocks picking from the signed-in user's own repos. A bad or
  // revoked token must degrade quietly to signed-out — it must never break
  // the plain URL-paste flow.
  useEffect(() => {
    let cancelled = false;
    if (!token) {
      setMe(null);
      setRepos([]);
      return;
    }
    (async () => {
      try {
        const client = makeClient();
        const [user, userRepos] = await Promise.all([client.getUser(), client.listUserRepos()]);
        if (!cancelled) {
          setMe(user);
          setRepos(userRepos);
        }
      } catch {
        if (!cancelled) {
          setMe(null);
          setRepos([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  function scanUserRepo(ownerRepo: string) {
    setUrl(ownerRepo);
    void run(ownerRepo);
  }

  async function createSkillsRepo() {
    if (!me) return;
    setRepoBusy(true);
    try {
      const client = makeClient();
      try {
        await client.createRepo({ name: "skills", isPrivate: false, description: "My Claude Agent Skills" });
      } catch (e) {
        if (!(e instanceof GitHubError) || e.status !== 422) throw e;
        // Name already exists — fall through and scan the existing repo.
      }
      await run(`${me.login}/skills`);
    } catch (error) {
      setView({ s: "error", error });
    } finally {
      setRepoBusy(false);
    }
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

  async function downloadAll(result: Extract<ImportResult, { mode: "picker" }>) {
    setBusyDir("__bulk__");
    setBulk({ running: true, step: "Preparing…" });
    try {
      const refs = result.skills.map((s) => s.ref);
      const { zips, skipped } = await fetchAllSkills(
        makeClient(),
        result.owner,
        result.repo,
        result.ref,
        refs,
        result.entries,
        (step) => setBulk({ running: true, step })
      );
      downloadBlob(`${result.repo}-skills.zip`, zipCollection(zips), "application/zip");
      setBulk({
        running: false,
        step:
          skipped.length > 0
            ? `Done — ${zips.length} skills downloaded, ${skipped.length} item(s) skipped.`
            : "",
      });
    } catch (error) {
      setView({ s: "error", error });
      setBulk({ running: false, step: "" });
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
      <h1 className="font-display text-3xl text-ink">Import a skill from GitHub</h1>
      <p className="mt-1 text-sm text-ink-soft">Paste a repo, gist, or owner/repo. Everything runs in your browser.</p>

      <form
        className="mt-4"
        onSubmit={(e) => {
          e.preventDefault();
          void run(url);
        }}
      >
        <label htmlFor="repo-url" className="block text-sm font-medium text-ink">
          Repository URL
        </label>
        <div className="mt-1 flex gap-2">
          <input
            id="repo-url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://github.com/owner/repo"
            className="flex-1 rounded border-2 border-ink bg-paper px-3 py-2 text-ink outline-none focus:border-ember"
          />
          <button type="submit" className="ink-btn px-4 py-2 font-medium">
            Import
          </button>
        </div>
        <TokenField token={token} onChange={updateToken} open={tokenOpen} onToggle={setTokenOpen} />
      </form>

      {view.s === "idle" && me && (
        <UserRepos
          login={me.login}
          repos={repos}
          busy={repoBusy}
          onScan={scanUserRepo}
          onCreateSkillsRepo={() => void createSkillsRepo()}
          onSignOut={() => updateToken("")}
        />
      )}

      <section className="mt-6">
        {view.s === "loading" && (
          <div className="flex items-center gap-2 text-sm text-ink-soft">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink/20 border-t-ember" aria-hidden />
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
          <p className="text-sm text-ink-soft">{view.result.reason}</p>
        )}

        {view.s === "result" && view.result.mode === "gist" && (
          <div className="ink-panel p-4">
            <p className="text-sm text-ink">
              Gist skill <span className="font-medium">{view.result.dirName}</span> — score{" "}
              {view.result.lint.ok ? view.result.lint.score : "n/a"}.
            </p>
            <button
              type="button"
              onClick={() => openGist(view.result as Extract<ImportResult, { mode: "gist" }>)}
              className="ink-btn mt-2 px-3 py-1 text-sm"
            >
              Open
            </button>
          </div>
        )}

        {view.s === "result" && view.result.mode === "picker" && (
          <div>
            {view.result.truncated && (
              <div className="ink-panel mb-3 p-3 text-sm text-severity-warning">
                This repository is very large; GitHub truncated the file tree, so these results are partial. Import a
                subfolder URL (…/tree/main/path) for complete results.
              </div>
            )}
            <p className="mb-2 text-sm text-ink-soft">
              Found {view.result.skills.length} skill{view.result.skills.length === 1 ? "" : "s"}.
            </p>
            {view.result.skills.length > 3 && <CollectionAudit skills={view.result.skills} />}
            {view.result.skills.length >= 2 && (
              <div className="mb-2 flex items-center gap-3">
                <button
                  type="button"
                  disabled={bulk.running || busyDir !== null}
                  onClick={() => view.result.mode === "picker" && downloadAll(view.result)}
                  className="ink-btn px-3 py-1 text-sm"
                >
                  {bulk.running ? "Downloading…" : "Download all (.zip)"}
                </button>
                {bulk.step && <span className="text-sm text-ink-soft">{bulk.step}</span>}
              </div>
            )}
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
