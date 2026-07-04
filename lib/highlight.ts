/**
 * Lossless line-based tokenizer for SKILL.md (YAML frontmatter + markdown body).
 *
 * Used to render a syntax-colored overlay behind the plain-text editor
 * textarea. Every token's `text` is a verbatim slice of the source — joining
 * all tokens in order reproduces the source exactly, including every
 * newline. This is what makes the overlay safe to lay on top of a real
 * textarea: no character is ever added, removed, or reordered.
 */

export type TokenKind =
  | "fm-delim"
  | "fm-key"
  | "fm-value"
  | "heading"
  | "fence"
  | "code"
  | "link"
  | "list"
  | "text";

export interface Token {
  text: string;
  kind: TokenKind;
}

const FM_KEY_RE = /^([A-Za-z][\w-]*):(.*)$/;
const HEADING_RE = /^#{1,6} /;
const FENCE_RE = /^(```|~~~)/;
const LIST_RE = /^(\s*)([-*+]|\d+\.)(\s)(.*)$/;
const INLINE_RE = /\[[^\]]*\]\([^)]*\)|`[^`]*`/g;

/** Split source into lines, each retaining its trailing "\n" (last line may have none). */
function splitLines(source: string): string[] {
  if (source === "") return [];
  const lines: string[] = [];
  let start = 0;
  for (let i = 0; i < source.length; i++) {
    if (source[i] === "\n") {
      lines.push(source.slice(start, i + 1));
      start = i + 1;
    }
  }
  if (start < source.length) {
    lines.push(source.slice(start));
  }
  return lines;
}

/** Tokenize inline markdown (links + inline code) within a plain text span, kind defaulting to "text". */
function tokenizeInline(text: string): Token[] {
  const tokens: Token[] = [];
  let lastIndex = 0;
  INLINE_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = INLINE_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ text: text.slice(lastIndex, match.index), kind: "text" });
    }
    const matched = match[0]!;
    tokens.push({ text: matched, kind: matched.startsWith("`") ? "code" : "link" });
    lastIndex = match.index + matched.length;
  }
  if (lastIndex < text.length) {
    tokens.push({ text: text.slice(lastIndex), kind: "text" });
  }
  return tokens;
}

export function highlightSkillMd(source: string): Token[] {
  const lines = splitLines(source);
  const tokens: Token[] = [];

  let i = 0;

  // Frontmatter block: only recognized when line 1 is exactly "---" (+ newline or EOF).
  if (lines.length > 0 && (lines[0] === "---\n" || lines[0] === "---")) {
    tokens.push({ text: lines[0]!, kind: "fm-delim" });
    i = 1;
    while (i < lines.length) {
      const line = lines[i]!;
      const stripped = line.endsWith("\n") ? line.slice(0, -1) : line;
      if (stripped === "---") {
        tokens.push({ text: line, kind: "fm-delim" });
        i++;
        break;
      }
      const m = FM_KEY_RE.exec(stripped);
      if (m) {
        const keyPart = `${m[1]}:`;
        const rest = line.slice(keyPart.length);
        tokens.push({ text: keyPart, kind: "fm-key" });
        if (rest.length > 0) tokens.push({ text: rest, kind: "fm-value" });
      } else {
        tokens.push({ text: line, kind: "fm-value" });
      }
      i++;
    }
  }

  let inFence = false;
  for (; i < lines.length; i++) {
    const line = lines[i]!;
    const stripped = line.endsWith("\n") ? line.slice(0, -1) : line;

    if (FENCE_RE.test(stripped)) {
      tokens.push({ text: line, kind: "fence" });
      inFence = !inFence;
      continue;
    }
    if (inFence) {
      tokens.push({ text: line, kind: "code" });
      continue;
    }
    if (HEADING_RE.test(stripped)) {
      tokens.push({ text: line, kind: "heading" });
      continue;
    }
    const listMatch = LIST_RE.exec(stripped);
    if (listMatch) {
      const [, indent, marker, space, rest] = listMatch;
      const consumed = (indent ?? "") + marker + space;
      if (indent) tokens.push({ text: indent, kind: "text" });
      tokens.push({ text: marker!, kind: "list" });
      tokens.push({ text: space!, kind: "text" });
      const trailingNewline = line.slice(consumed.length + rest!.length);
      tokens.push(...tokenizeInline(rest!));
      if (trailingNewline) tokens.push({ text: trailingNewline, kind: "text" });
      continue;
    }
    tokens.push(...tokenizeInline(line));
  }

  return tokens;
}
