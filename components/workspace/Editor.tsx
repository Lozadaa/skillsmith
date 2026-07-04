"use client";

import { useRef } from "react";
import type { SkillFile } from "@/lib/skill-lint";
import { highlightSkillMd, type TokenKind } from "@/lib/highlight";

/** Shared font/size/line-height/padding/whitespace so the overlay and the
 *  textarea line up character-for-character. Keep these two class lists
 *  identical (aside from color/interaction utilities) or the overlay drifts. */
const EDITOR_METRICS = "w-full flex-1 p-4 font-mono text-sm leading-relaxed whitespace-pre-wrap break-words";

const TOKEN_CLASS: Record<TokenKind, string> = {
  "fm-delim": "text-ink-soft",
  "fm-key": "text-ember-deep",
  "fm-value": "text-ink",
  heading: "text-ink font-bold",
  fence: "text-ink-soft",
  code: "text-ink-soft",
  link: "text-ember-deep underline",
  list: "text-ink-soft",
  text: "text-ink",
};

export function Editor({
  file,
  onChange,
}: {
  file: SkillFile | undefined;
  onChange: (content: string) => void;
}) {
  const preRef = useRef<HTMLPreElement>(null);

  if (!file) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-ink-soft">
        No file selected.
      </div>
    );
  }

  const tokens = highlightSkillMd(file.content);

  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (preRef.current) {
      preRef.current.scrollTop = e.currentTarget.scrollTop;
      preRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b-2 border-ink px-3 py-1.5 font-mono text-xs text-ink-soft">
        {file.path}
      </div>
      <div className="relative min-h-0 flex-1">
        <pre
          ref={preRef}
          aria-hidden="true"
          className={`${EDITOR_METRICS} pointer-events-none absolute inset-0 overflow-hidden bg-paper`}
        >
          {tokens.map((token, i) => (
            <span key={i} className={TOKEN_CLASS[token.kind]}>
              {token.text}
            </span>
          ))}
          {/* Trailing-newline quirk: browsers collapse a source-final "\n" when
              measuring textarea content height, which would leave the overlay
              one line short. Append a zero-width joiner so the last visual
              line always exists in both layers. */}
          {file.content.endsWith("\n") && "​"}
        </pre>
        <textarea
          value={file.content}
          onChange={(e) => onChange(e.target.value)}
          onScroll={handleScroll}
          spellCheck={false}
          aria-label={`Editor for ${file.path}`}
          className={`${EDITOR_METRICS} absolute inset-0 resize-none bg-transparent text-transparent caret-ink outline-none selection:bg-ink/20`}
        />
      </div>
    </div>
  );
}
