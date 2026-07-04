"use client";
import type { RepoLink } from "@/lib/github/links";

export default function LinksList({ links, onScan }: { links: RepoLink[]; onScan: (link: RepoLink) => void }) {
  if (links.length === 0) {
    return <p className="text-sm text-gray-600">No skills and no linked GitHub repos were found in this repository.</p>;
  }
  return (
    <div>
      <p className="mb-2 text-sm text-gray-600">
        No SKILL.md here — but this looks like an awesome-list. Pick a linked repo to scan:
      </p>
      <ul className="divide-y rounded border">
        {links.map((l) => (
          <li key={`${l.owner}/${l.repo}`} className="flex items-center justify-between px-3 py-2">
            <span className="text-sm">
              <span className="font-medium">{l.label}</span>{" "}
              <span className="text-gray-500">
                {l.owner}/{l.repo}
              </span>
            </span>
            <button type="button" onClick={() => onScan(l)} className="rounded bg-blue-600 px-3 py-1 text-sm text-white">
              Scan
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
