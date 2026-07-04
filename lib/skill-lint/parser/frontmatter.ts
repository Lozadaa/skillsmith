import { parseDocument, isMap, isScalar } from "yaml";
import type { Frontmatter, KeyOccurrence } from "../model";

export interface ExtractResult {
  frontmatter: Frontmatter;
  bodyRaw: string;
  bodyStartLine: number;
}

export function extractFrontmatter(content: string): ExtractResult | null {
  const src = content.replace(/^﻿/, "");
  const lines = src.split("\n");
  if (lines[0]?.trim() !== "---") return null;

  const closing = lines.findIndex((l, i) => i > 0 && l.trim() === "---");
  if (closing === -1) {
    return {
      frontmatter: {
        raw: lines.slice(1).join("\n"),
        data: {},
        keyOccurrences: [],
        parseError: { message: "Unclosed frontmatter: no closing --- found", line: 1 },
      },
      bodyRaw: "",
      bodyStartLine: lines.length + 1,
    };
  }

  const raw = lines.slice(1, closing).join("\n");
  const frontmatter = parseYamlTolerant(raw);
  return {
    frontmatter,
    bodyRaw: lines.slice(closing + 1).join("\n"),
    bodyStartLine: closing + 2,
  };
}

function parseYamlTolerant(raw: string): Frontmatter {
  const first = tryParse(raw);
  if (first) return { raw, ...first };

  // Recovery: quote plain-scalar values that contain ": " (breaks YAML mappings).
  const fixedRaw = raw
    .split("\n")
    .map((line) => {
      const m = /^([A-Za-z][\w-]*):\s+(.*)$/.exec(line);
      if (m && m[2].includes(": ") && !/^["'|>&[{]/.test(m[2].trim())) {
        return `${m[1]}: ${JSON.stringify(m[2])}`;
      }
      return line;
    })
    .join("\n");

  if (fixedRaw !== raw) {
    const second = tryParse(fixedRaw);
    if (second && !second.parseError) {
      return { raw, ...second, recovered: true, fixedRaw };
    }
  }

  // Unrecoverable: report the original error, keep data empty.
  const doc = parseDocument(raw, { uniqueKeys: false });
  const err = doc.errors[0];
  return {
    raw,
    data: {},
    keyOccurrences: [],
    parseError: {
      message: err ? err.message.split("\n")[0] : "Invalid YAML frontmatter",
      line: err ? offsetToLine(raw, err.pos[0]) + 2 : undefined,
    },
  };
}

type ParsedYaml = Pick<Frontmatter, "data" | "keyOccurrences" | "parseError">;

function tryParse(raw: string): ParsedYaml | null {
  const doc = parseDocument(raw, { uniqueKeys: false });
  if (doc.errors.length > 0) return null;
  if (!isMap(doc.contents)) {
    return {
      data: {},
      keyOccurrences: [],
      parseError: { message: "Frontmatter is not a YAML mapping (key: value pairs expected)" },
    };
  }
  const data: Record<string, unknown> = {};
  const keyOccurrences: KeyOccurrence[] = [];
  for (const pair of doc.contents.items) {
    const keyNode = pair.key;
    const key = isScalar(keyNode) ? String(keyNode.value) : String(keyNode);
    const offset = isScalar(keyNode) && keyNode.range ? keyNode.range[0] : 0;
    keyOccurrences.push({ key, line: offsetToLine(raw, offset) + 2 }); // +2: line 1 is ---
    data[key] = pair.value == null ? null : (pair.value as { toJSON(): unknown }).toJSON();
  }
  return { data, keyOccurrences };
}

function offsetToLine(text: string, offset: number): number {
  let line = 0;
  for (let i = 0; i < offset && i < text.length; i++) {
    if (text[i] === "\n") line++;
  }
  return line;
}
