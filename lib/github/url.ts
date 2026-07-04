export type ParsedTarget =
  | { kind: "repo"; owner: string; repo: string; ref?: string; subPath?: string }
  | { kind: "gist"; gistId: string };

const GIST_HOST = "gist.github.com";

/**
 * Parses a GitHub repo, gist, tree/blob, or bare `owner/repo` reference.
 * Ref is treated as a single path segment (branch names with slashes are not
 * disambiguable from a URL alone; this matches how github.com renders them).
 */
export function parseGitHubUrl(input: string): ParsedTarget | null {
  if (!input) return null;
  let s = input.trim();
  if (s === "") return null;

  // Strip a git+ prefix and any scheme://, then a leading www.
  s = s.replace(/^git\+/i, "").replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//, "");
  s = s.replace(/^www\./i, "");
  // Drop fragment then query.
  s = s.split("#")[0].split("?")[0];
  // Collapse trailing slashes.
  s = s.replace(/\/+$/, "");

  // Split host from path. A first segment containing a dot is treated as a host.
  let host = "";
  let path = s;
  const firstSlash = s.indexOf("/");
  const firstSeg = firstSlash === -1 ? s : s.slice(0, firstSlash);
  if (firstSeg.includes(".")) {
    host = firstSeg.toLowerCase();
    path = firstSlash === -1 ? "" : s.slice(firstSlash + 1);
  }

  const segments = path.split("/").filter(Boolean);

  if (host === GIST_HOST) {
    const gistId = segments[segments.length - 1];
    if (!gistId) return null;
    return { kind: "gist", gistId: stripGit(gistId) };
  }

  // github.com host, or bare `owner/repo` shorthand (no host).
  if (host === "" || host === "github.com") {
    if (segments.length < 2) return null;
    const owner = segments[0];
    const repo = stripGit(segments[1]);
    if (!owner || !repo) return null;
    const rest = segments.slice(2);
    if (rest.length >= 2 && (rest[0] === "tree" || rest[0] === "blob")) {
      const ref = rest[1];
      const subPath = rest.slice(2).join("/") || undefined;
      return subPath ? { kind: "repo", owner, repo, ref, subPath } : { kind: "repo", owner, repo, ref };
    }
    // Unknown trailing path (issues, pulls, wiki, …) → resolve the repo root.
    return { kind: "repo", owner, repo };
  }

  return null;
}

function stripGit(s: string): string {
  return s.replace(/\.git$/i, "");
}
