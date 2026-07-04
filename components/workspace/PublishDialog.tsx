"use client";

import { useEffect, useState } from "react";
import type { SkillFile } from "@/lib/skill-lint";
import { createClient, GitHubError, NotFoundError, RateLimitError, type UserRepo } from "@/lib/github/client";
import { parseGitHubUrl } from "@/lib/github/url";
import { publishSkill, type PublishTarget } from "@/lib/github/publish";
import { useLocale } from "@/components/LocaleProvider";
import { STRINGS } from "@/lib/i18n";

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

function friendlyError(e: unknown, t: (key: string) => string): string {
  if (e instanceof RateLimitError) return t("publishDialog.error.rateLimit");
  if (e instanceof NotFoundError) return t("publishDialog.error.notFound");
  if (e instanceof GitHubError) return e.message;
  return e instanceof Error ? e.message : t("publishDialog.error.generic");
}

export function PublishDialog({
  open,
  onClose,
  files,
  dirName,
  publishFn = publishSkill,
  createClientFn = createClient,
}: PublishDialogProps) {
  const { t, locale } = useLocale();
  // "Published to {url}." wraps a clickable <a> around the URL segment — split
  // the template on the placeholder so the link keeps its own DOM node instead
  // of being flattened into plain text.
  const [publishedPrefix, publishedSuffix] = (
    STRINGS[locale]?.["publishDialog.published"] ?? STRINGS.en["publishDialog.published"]
  ).split("{url}");
  const [token, setToken] = useState("");
  const [mode, setMode] = useState<Mode>("new-repo");
  const [repoName, setRepoName] = useState(dirName);
  const [isPrivate, setIsPrivate] = useState(false);
  const [ownerRepo, setOwnerRepo] = useState("");
  const [branch, setBranch] = useState("");
  const [pathPrefix, setPathPrefix] = useState(`skills/${dirName}`);
  const [message, setMessage] = useState(`Add ${dirName} skill`);
  const [state, setState] = useState<State>({ s: "idle" });
  const [me, setMe] = useState<{ login: string } | null>(null);
  const [repos, setRepos] = useState<UserRepo[]>([]);

  // Token lives only in localStorage, read/written in the UI layer.
  useEffect(() => {
    try {
      setToken(localStorage.getItem(TOKEN_KEY) ?? "");
    } catch {
      /* storage blocked — in-memory only */
    }
  }, []);

  // If a signed-in token is already stored, quietly fetch the user's repos so
  // the existing-repo field can autocomplete. A bad/revoked token just means
  // no autocomplete — never surface an error for this.
  useEffect(() => {
    let cancelled = false;
    if (!token.trim()) {
      setMe(null);
      setRepos([]);
      return;
    }
    (async () => {
      try {
        const client = createClientFn({ token: token.trim(), fetchFn: fetch });
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
      if (!name) return { error: t("publishDialog.error.nameRequired") };
      return { mode: "new-repo", name, isPrivate };
    }
    const parsed = parseGitHubUrl(ownerRepo.trim());
    if (!parsed || parsed.kind !== "repo") {
      return { error: t("publishDialog.error.ownerRepoRequired") };
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
      setState({ s: "error", message: t("publishDialog.error.tokenRequired") });
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
      setState({ s: "error", message: friendlyError(e, t) });
    }
  }

  const publishing = state.s === "publishing";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4" role="dialog" aria-modal="true" aria-label={t("publishDialog.title")}>
      <div className="ink-panel-b w-full max-w-lg p-5 text-ink">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg">{t("publishDialog.title")}</h2>
          <button type="button" onClick={onClose} className="text-ink-soft hover:text-ink">
            {t("publishDialog.close")}
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-1">
          <label htmlFor="pub-token" className="text-sm text-ink-soft">
            {t("publishDialog.tokenLabel")}
          </label>
          <input
            id="pub-token"
            type="password"
            value={token}
            onChange={(e) => updateToken(e.target.value)}
            placeholder="ghp_…"
            autoComplete="off"
            className="rounded border-2 border-ink bg-paper px-2 py-1 text-sm text-ink"
          />
          <span className="text-xs text-ink-soft">{t("publishDialog.tokenNote")}</span>
        </div>

        <fieldset className="mt-4">
          <legend className="text-sm text-ink-soft">{t("publishDialog.destinationLegend")}</legend>
          <label className="mt-1 flex items-center gap-2 text-sm text-ink">
            <input type="radio" name="pub-mode" checked={mode === "new-repo"} onChange={() => setMode("new-repo")} />
            {t("publishDialog.newRepo")}
          </label>
          <label className="mt-1 flex items-center gap-2 text-sm text-ink">
            <input type="radio" name="pub-mode" aria-label={t("publishDialog.existingRepo")} checked={mode === "existing"} onChange={() => setMode("existing")} />
            {t("publishDialog.existingRepo")}
          </label>
        </fieldset>

        {mode === "new-repo" ? (
          <div className="mt-3 flex flex-col gap-2">
            <label htmlFor="pub-name" className="text-sm text-ink-soft">{t("publishDialog.repoNameLabel")}</label>
            <input
              id="pub-name"
              value={repoName}
              onChange={(e) => setRepoName(e.target.value)}
              className="rounded border-2 border-ink bg-paper px-2 py-1 text-sm text-ink"
            />
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} />
              {t("publishDialog.privateRepo")}
            </label>
            {me && (
              <p className="text-xs text-ink-soft">
                {t("publishDialog.willCreate", { login: me.login, repo: repoName.trim() || "…" })}
              </p>
            )}
          </div>
        ) : (
          <div className="mt-3 flex flex-col gap-2">
            <label htmlFor="pub-repo" className="text-sm text-ink-soft">
              {t("publishDialog.ownerRepoLabel")}{repos.length > 0 && t("publishDialog.autocompleteHint")}
            </label>
            <input
              id="pub-repo"
              list="pub-repo-options"
              value={ownerRepo}
              onChange={(e) => setOwnerRepo(e.target.value)}
              placeholder="owner/repo"
              autoComplete="off"
              className="rounded border-2 border-ink bg-paper px-2 py-1 text-sm text-ink"
            />
            {repos.length > 0 && (
              <datalist id="pub-repo-options">
                {repos.map((r) => (
                  <option key={`${r.owner}/${r.repo}`} value={`${r.owner}/${r.repo}`} />
                ))}
              </datalist>
            )}
            <label htmlFor="pub-branch" className="text-sm text-ink-soft">{t("publishDialog.branchLabel")}</label>
            <input
              id="pub-branch"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              placeholder="main"
              className="rounded border-2 border-ink bg-paper px-2 py-1 text-sm text-ink"
            />
            <label htmlFor="pub-prefix" className="text-sm text-ink-soft">{t("publishDialog.pathPrefixLabel")}</label>
            <input
              id="pub-prefix"
              value={pathPrefix}
              onChange={(e) => setPathPrefix(e.target.value)}
              className="rounded border-2 border-ink bg-paper px-2 py-1 text-sm text-ink"
            />
            <span className="text-xs text-ink-soft">{t("publishDialog.overwriteNote")}</span>
          </div>
        )}

        <div className="mt-3 flex flex-col gap-1">
          <label htmlFor="pub-message" className="text-sm text-ink-soft">{t("publishDialog.commitMessageLabel")}</label>
          <input
            id="pub-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="rounded border-2 border-ink bg-paper px-2 py-1 text-sm text-ink"
          />
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={onPublish}
            disabled={publishing}
            className="ink-btn px-4 py-1.5 text-sm font-medium"
          >
            {publishing ? t("publishDialog.publishing") : t("publishDialog.publish")}
          </button>
          {publishing && <span className="text-sm text-ink-soft">{t("publishDialog.creatingCommit")}</span>}
        </div>

        {state.s === "error" && (
          <p className="mt-3 rounded border-2 border-severity-error px-3 py-2 text-sm text-severity-error">{state.message}</p>
        )}
        {state.s === "done" && (
          <div className="mt-3 rounded border-2 border-ink px-3 py-2 text-sm text-ink">
            <p>
              {publishedPrefix}
              <a href={state.htmlUrl} target="_blank" rel="noreferrer" className="underline">
                {state.htmlUrl.replace(/^https?:\/\//, "")}
              </a>
              {publishedSuffix}
            </p>
            {state.skipped.length > 0 && (
              <p className="mt-1 text-ink-soft">{t("publishDialog.skippedSymlinks", { count: state.skipped.length, list: state.skipped.join(", ") })}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
