"use client";
import { useState } from "react";
import type { UserRepo } from "@/lib/github/client";
import { useLocale } from "@/components/LocaleProvider";

export default function UserRepos({
  login,
  repos,
  busy,
  onScan,
  onCreateSkillsRepo,
  onSignOut,
}: {
  login: string;
  repos: UserRepo[];
  busy: boolean;
  onScan: (ownerRepo: string) => void;
  onCreateSkillsRepo: () => void;
  onSignOut: () => void;
}) {
  const { t } = useLocale();
  const [filter, setFilter] = useState("");
  const needle = filter.trim().toLowerCase();
  const MAX_RESULTS = 10;
  // Search-first: nothing is listed until the user types; only matches render.
  const matches = needle
    ? repos.filter((r) => `${r.owner}/${r.repo} ${r.description}`.toLowerCase().includes(needle))
    : [];
  const visible = matches.slice(0, MAX_RESULTS);
  const overflow = matches.length - visible.length;

  return (
    <div className="ink-panel mt-4 p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink">
          {t("userRepos.signedInAs").split("{login}")[0]}
          <span className="font-medium">{login}</span>
          {t("userRepos.signedInAs").split("{login}")[1]}
        </p>
        <button type="button" onClick={onSignOut} className="ink-underline text-sm text-ink hover:text-ember-deep">
          {t("userRepos.signOut")}
        </button>
      </div>

      <button type="button" disabled={busy} onClick={onCreateSkillsRepo} className="ink-btn mt-2 px-3 py-1 text-sm">
        {busy ? t("userRepos.creating") : t("userRepos.createRepo")}
      </button>

      <input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder={t("userRepos.searchPlaceholder")}
        aria-label={t("userRepos.searchAriaLabel")}
        className="mt-2 w-full rounded border-2 border-ink bg-paper px-2 py-1 text-sm text-ink outline-none focus:border-ember"
      />

      {needle === "" ? (
        <p className="mt-2 text-sm text-ink-soft">{t("userRepos.countLabel", { count: repos.length })}</p>
      ) : visible.length === 0 ? (
        <p className="mt-2 text-sm text-ink-soft">{t("userRepos.noMatch")}</p>
      ) : (
        <ul className="mt-2 divide-y divide-ink/30">
          {visible.map((r) => (
            <li key={`${r.owner}/${r.repo}`} className="flex items-center justify-between gap-2 py-2">
              <span className="min-w-0 text-sm text-ink">
                <span className="font-medium">
                  {r.owner}/{r.repo}
                </span>
                {r.isPrivate && (
                  <span className="ml-2 rounded border border-ink px-1 text-xs text-ink-soft">
                    {t("userRepos.private")}
                  </span>
                )}
                {r.description && <span className="block truncate text-xs text-ink-soft">{r.description}</span>}
              </span>
              <button type="button" onClick={() => onScan(`${r.owner}/${r.repo}`)} className="ink-btn px-3 py-1 text-sm">
                {t("userRepos.scan")}
              </button>
            </li>
          ))}
        </ul>
      )}
      {overflow > 0 && (
        <p className="mt-1 text-xs text-ink-soft">
          {t(overflow === 1 ? "userRepos.overflow.singular" : "userRepos.overflow.plural", { overflow })}
        </p>
      )}
    </div>
  );
}
