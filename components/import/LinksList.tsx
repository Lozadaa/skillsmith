"use client";
import type { RepoLink } from "@/lib/github/links";
import { useLocale } from "@/components/LocaleProvider";

export default function LinksList({ links, onScan }: { links: RepoLink[]; onScan: (link: RepoLink) => void }) {
  const { t } = useLocale();
  if (links.length === 0) {
    return <p className="text-sm text-ink-soft">{t("linksList.none")}</p>;
  }
  return (
    <div>
      <p className="mb-2 text-sm text-ink-soft">{t("linksList.intro")}</p>
      <ul className="ink-panel divide-y divide-ink/30">
        {links.map((l) => (
          <li key={`${l.owner}/${l.repo}`} className="flex items-center justify-between px-3 py-2">
            <span className="text-sm text-ink">
              <span className="font-medium">{l.label}</span>{" "}
              <span className="text-ink-soft">
                {l.owner}/{l.repo}
              </span>
            </span>
            <button type="button" onClick={() => onScan(l)} className="ink-btn px-3 py-1 text-sm">
              {t("userRepos.scan")}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
