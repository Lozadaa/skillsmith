"use client";

import { useEffect, useRef } from "react";
import type { SkillFile } from "@/lib/skill-lint";
import { highlightSkillMd, type TokenKind } from "@/lib/highlight";
import { useLocale } from "@/components/LocaleProvider";

/** Shared font/size/line-height/padding/whitespace so the overlay and the
 *  textarea line up character-for-character. Keep these two class lists
 *  identical (aside from color/interaction utilities) or the overlay drifts. */
/** [scrollbar-gutter:stable] reserves the same scrollbar gutter on BOTH
 *  layers, so the overlay <pre> (no visible scrollbar) and the textarea
 *  (scrollbar when overflowing) always wrap lines at the identical width —
 *  without it, wrapped lines drift and the highlight turns to garble. */
const EDITOR_METRICS =
  "w-full flex-1 p-4 font-mono text-sm leading-relaxed whitespace-pre-wrap break-words [scrollbar-gutter:stable]";

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

/** Copy the textarea's scroll position onto the overlay <pre> so the two layers stay aligned. */
function syncScroll(textarea: HTMLTextAreaElement, pre: HTMLPreElement) {
  pre.scrollTop = textarea.scrollTop;
  pre.scrollLeft = textarea.scrollLeft;
}

export function Editor({
  file,
  onChange,
}: {
  file: SkillFile | undefined;
  onChange: (content: string) => void;
}) {
  const { t } = useLocale();
  const preRef = useRef<HTMLPreElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Switching files can leave the overlay desynced from the textarea (e.g. if
  // the previous file was scrolled and the new one loads at scrollTop 0), since
  // the overlay only otherwise resyncs on the textarea's own onScroll event.
  useEffect(() => {
    if (preRef.current && textareaRef.current) {
      syncScroll(textareaRef.current, preRef.current);
    }
  }, [file?.path]);

  if (!file) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-ink-soft">
        {t("editor.noFile")}
      </div>
    );
  }

  const tokens = highlightSkillMd(file.content);

  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (preRef.current) {
      syncScroll(e.currentTarget, preRef.current);
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
              one line short. Append a zero-width space so the last visual
              line always exists in both layers. */}
          {file.content.endsWith("\n") && "​"}
        </pre>
        <textarea
          ref={textareaRef}
          value={file.content}
          onChange={(e) => onChange(e.target.value)}
          onScroll={handleScroll}
          spellCheck={false}
          aria-label={t("editor.ariaLabel", { path: file.path })}
          className={`${EDITOR_METRICS} absolute inset-0 resize-none bg-transparent text-transparent caret-ink outline-none selection:bg-ink/20 selection:text-transparent`}
        />
      </div>
    </div>
  );
}
