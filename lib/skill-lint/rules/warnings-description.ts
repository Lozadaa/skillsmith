import type { Rule } from "../model";
import { mk } from "./util";

const FIRST_SECOND_PERSON = /\b(I can|I will|I'll|you can|you should|you need|use this skill when you)\b/i;
const TRIGGER_MARKER = /use when|when the user|when working|when you need|triggers?:/i;
const GENERIC_NAME_SEGMENTS = new Set([
  "helper", "helpers", "util", "utils", "tool", "tools", "data", "files", "documents", "misc", "stuff",
]);

function str(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

/** Returns the description only when it is a non-empty string (missing/empty is E05's job). */
function descOf(data: Record<string, unknown>): string | undefined {
  const d = str(data["description"]);
  return d !== undefined && d.trim().length > 0 ? d : undefined;
}

const w02: Rule = {
  id: "W02",
  severity: "warning",
  check(s) {
    const desc = descOf(s.frontmatter.data);
    if (desc === undefined || desc.trim().length >= 20) return [];
    return [
      mk("W02", "warning",
        `description is only ${desc.trim().length} characters`,
        "A description under 20 characters cannot express both what the skill does and when to use it, so Claude rarely triggers it.",
        'Expand it to name the capability and its triggers, e.g. "Use when reviewing pull requests for security issues".'),
    ];
  },
};

const w03: Rule = {
  id: "W03",
  severity: "warning",
  check(s) {
    const desc = descOf(s.frontmatter.data);
    if (desc === undefined || desc.length < 501 || desc.length > 1024) return [];
    return [
      mk("W03", "warning",
        `description is ${desc.length} characters (soft limit 500)`,
        "The spec allows up to 1024 chars, but descriptions are loaded into every conversation; long ones bloat the system prompt and dilute the trigger signal.",
        "Trim to ~500 characters — keep what it does and when to use it, move detail into the body."),
    ];
  },
};

const w04: Rule = {
  id: "W04",
  severity: "warning",
  check(s) {
    const desc = descOf(s.frontmatter.data);
    if (desc === undefined || !FIRST_SECOND_PERSON.test(desc)) return [];
    return [
      mk("W04", "warning",
        "description uses first/second person phrasing",
        'Descriptions read best as third-person capability statements; "I can" / "you should" phrasing weakens the trigger and wastes characters.',
        'Rewrite in third person, e.g. "Reviews pull requests…" or "Use when reviewing…".'),
    ];
  },
};

const w05: Rule = {
  id: "W05",
  severity: "warning",
  check(s) {
    const desc = descOf(s.frontmatter.data);
    if (desc === undefined || TRIGGER_MARKER.test(desc)) return [];
    return [
      mk("W05", "warning",
        "description has no explicit trigger marker",
        "Claude decides whether to load a skill from its description; without a clear trigger phrase it is often missed.",
        'Add an explicit trigger, e.g. "Use when …", "when the user …", or "Triggers: …".'),
    ];
  },
};

const w07: Rule = {
  id: "W07",
  severity: "warning",
  check(s) {
    const name = str(s.frontmatter.data["name"]);
    if (name === undefined) return [];
    const offending = name.toLowerCase().split("-").find((seg) => GENERIC_NAME_SEGMENTS.has(seg));
    if (!offending) return [];
    return [
      mk("W07", "warning",
        `name contains the generic word "${offending}"`,
        "Generic names like helper/utils/tools describe nothing; they collide with other skills and never match how users phrase requests.",
        "Rename around the concrete capability, e.g. processing-pdfs instead of pdf-tools."),
    ];
  },
};

export const warningDescriptionRules: Rule[] = [w02, w03, w04, w05, w07];
