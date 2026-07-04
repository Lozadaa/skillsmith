"use client";
import type { RepoLink } from "@/lib/github/links";

export default function LinksList({ links, onScan }: { links: RepoLink[]; onScan: (link: RepoLink) => void }) {
  if (links.length === 0) {
    return <p className="text-sm text-ink-soft">No skills and no linked GitHub repos were found in this repository.</p>;
  }
  return (
    <div>
      <p className="mb-2 text-sm text-ink-soft">
        No SKILL.md here — but this looks like an awesome-list. Pick a linked repo to scan:
      </p>
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
              Scan
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
