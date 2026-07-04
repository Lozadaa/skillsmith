const NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export interface NameCheck {
  ok: boolean;
  message?: string;
}

/** Mirrors engine rules E02 (format/length) and E03 (reserved words). */
export function validateName(name: string): NameCheck {
  if (!name) return { ok: false, message: "Add a name in kebab-case, e.g. processing-pdfs." };
  if (name.length > 64) return { ok: false, message: `name is ${name.length} chars (max 64).` };
  if (/(claude|anthropic)/i.test(name)) {
    return { ok: false, message: `"${name}" contains a reserved word (claude/anthropic).` };
  }
  if (!NAME_RE.test(name)) {
    return {
      ok: false,
      message: `"${name}" is not kebab-case — lowercase letters, digits and single hyphens, no leading/trailing hyphen.`,
    };
  }
  return { ok: true };
}
