import type { Heading, LinkRef, SkillBody } from "../model";

const FENCE_RE = /^\s*(```|~~~)/;
const HEADING_RE = /^(#{1,6})\s+(.+)$/;
const MD_LINK_RE = /\[[^\]]*\]\(([^)\s]+)(?:\s[^)]*)?\)/g;
const BACKTICK_PATH_RE = /`([^`\s]+\/[^`\s]+\.\w+)`/g;

export function parseBody(raw: string, startLine: number): SkillBody {
  const lines = raw.split("\n");
  const proseLines: { text: string; line: number }[] = [];
  const headings: Heading[] = [];
  const links: LinkRef[] = [];
  let inFence = false;

  lines.forEach((text, i) => {
    const line = startLine + i;
    if (FENCE_RE.test(text)) {
      inFence = !inFence;
      return;
    }
    if (inFence) return;
    proseLines.push({ text, line });

    const h = HEADING_RE.exec(text);
    if (h) headings.push({ depth: h[1].length, text: h[2].trim(), line });

    for (const m of text.matchAll(MD_LINK_RE)) {
      links.push({ target: m[1], line, kind: "link" });
    }
    for (const m of text.matchAll(BACKTICK_PATH_RE)) {
      links.push({ target: m[1], line, kind: "path" });
    }
  });

  return {
    raw,
    lines,
    proseLines,
    headings,
    links,
    wordCount: raw.split(/\s+/).filter(Boolean).length,
  };
}
