import { parseGitHubUrl } from "./url";

export interface RepoLink {
  owner: string;
  repo: string;
  label: string;
}

// [label](url "optional title") — capture the leading "!" so images can be skipped.
const LINK_RE = /(!?)\[([^\]]*)\]\(\s*([^)\s]+)(?:\s+"[^"]*")?\s*\)/g;

export function extractRepoLinks(readmeMarkdown: string): RepoLink[] {
  const out: RepoLink[] = [];
  const seen = new Set<string>();
  for (const m of readmeMarkdown.matchAll(LINK_RE)) {
    if (m[1] === "!") continue; // image
    const label = m[2].trim();
    const url = m[3];
    if (url.startsWith("#")) continue; // anchor
    if (!/github\.com/i.test(url)) continue; // github only (avoids relative-path false positives)
    const parsed = parseGitHubUrl(url);
    if (!parsed || parsed.kind !== "repo") continue;
    const key = `${parsed.owner}/${parsed.repo}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ owner: parsed.owner, repo: parsed.repo, label: label || key });
    if (out.length >= 100) break;
  }
  return out;
}
