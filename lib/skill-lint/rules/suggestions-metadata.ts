import type { Rule } from "../model";
import { mk } from "./util";

const NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const QUOTED = /"[^"]{3,}"/;
const NEGATIVE_TRIGGER = /do not use|don't use|not for/i;
const LICENSE_FILE = /^LICENSE(\.(txt|md))?$/i;

function str(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

const s01: Rule = {
  id: "S01",
  severity: "suggestion",
  check(s) {
    const name = str(s.frontmatter.data["name"]);
    if (name === undefined || !NAME_RE.test(name)) return [];
    if (name.split("-")[0].endsWith("ing")) return [];
    return [
      mk("S01", "suggestion",
        `name "${name}" does not start with a gerund verb`,
        "Verb-first gerund names (creating-x, reviewing-y) read as capabilities and match how users phrase requests.",
        "Consider a verb-first gerund, e.g. processing-pdfs rather than pdf-processor."),
    ];
  },
};

const s02: Rule = {
  id: "S02",
  severity: "suggestion",
  check(s) {
    const desc = str(s.frontmatter.data["description"]);
    if (desc === undefined || desc.trim().length === 0 || QUOTED.test(desc)) return [];
    return [
      mk("S02", "suggestion",
        "description has no quoted trigger phrase",
        "Quoting the exact phrases users type (\"review my PR\") sharpens the match between a request and the skill.",
        'Add a quoted example phrase to the description, e.g. Use when the user says "…".'),
    ];
  },
};

const s03: Rule = {
  id: "S03",
  severity: "suggestion",
  check(s) {
    const desc = str(s.frontmatter.data["description"]);
    if (desc === undefined || desc.length <= 200 || NEGATIVE_TRIGGER.test(desc)) return [];
    return [
      mk("S03", "suggestion",
        "broad description has no negative trigger",
        "A wide-scoped skill fires on unrelated requests unless it also says when NOT to trigger.",
        'Add a negative trigger, e.g. "Do not use for …".'),
    ];
  },
};

const s11: Rule = {
  id: "S11",
  severity: "suggestion",
  check(s) {
    const hasKey = s.frontmatter.data["license"] !== undefined;
    const hasFile = s.files.some((f) => LICENSE_FILE.test(f.path));
    if (hasKey && !hasFile) {
      return [
        mk("S11", "suggestion",
          "license is declared but no LICENSE file is included",
          "Declaring a license without shipping its text leaves the terms unstated for anyone who installs the skill.",
          "Add a LICENSE (or LICENSE.txt/.md) file matching the declared license."),
      ];
    }
    if (hasFile && !hasKey) {
      return [
        mk("S11", "suggestion",
          "a LICENSE file is present but no license field is set",
          "The frontmatter license field is what tools read; a bare file is easy to miss.",
          "Add license: <spdx-id> to the frontmatter to match the LICENSE file."),
      ];
    }
    return [];
  },
};

const s15: Rule = {
  id: "S15",
  severity: "suggestion",
  check(s) {
    const data = s.frontmatter.data;
    const md = data["metadata"];
    const hasMetaVersion =
      !!md && typeof md === "object" && !Array.isArray(md) && (md as Record<string, unknown>)["version"] !== undefined;
    if (data["version"] !== undefined || hasMetaVersion) return [];
    return [
      mk("S15", "suggestion",
        "no version is declared for the skill",
        "Versioning lets consumers tell editions apart and know when to re-import an updated skill.",
        "Add metadata.version (e.g. 1.0.0) so changes are traceable."),
    ];
  },
};

export const suggestionMetadataRules: Rule[] = [s01, s02, s03, s11, s15];
