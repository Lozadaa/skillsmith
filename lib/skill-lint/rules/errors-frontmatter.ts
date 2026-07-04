import type { Finding, ParsedSkill, Rule } from "../model";
import { mk } from "./util";

const NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const OFFICIAL_DOCS = "https://agentskills.io/specification";

function str(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

const e01: Rule = {
  id: "E01",
  severity: "error",
  check(s) {
    if (!s.frontmatter.parseError || s.frontmatter.recovered) return [];
    return [
      mk("E01", "error",
        `Frontmatter is not valid YAML: ${s.frontmatter.parseError.message}`,
        "Claude cannot load a skill whose frontmatter does not parse — the skill is silently ignored.",
        "Fix the YAML syntax between the --- delimiters. Common causes: bad indentation, unclosed quotes.",
        { line: s.frontmatter.parseError.line }),
    ];
  },
};

const e02: Rule = {
  id: "E02",
  severity: "error",
  check(s) {
    const name = str(s.frontmatter.data["name"]);
    const out: Finding[] = [];
    if (!name) {
      out.push(mk("E02", "error", "Missing required field: name",
        "name and description are the only required fields — without name the skill cannot be registered.",
        `Add name: your-skill-name (kebab-case). Spec: ${OFFICIAL_DOCS}`));
      return out;
    }
    if (name.length > 64) {
      out.push(mk("E02", "error", `name is ${name.length} chars (max 64)`,
        "The official validator rejects names over 64 characters.",
        "Shorten the name to 64 characters or fewer."));
    }
    if (!NAME_RE.test(name)) {
      out.push(mk("E02", "error", `name "${name}" is not kebab-case`,
        "Names must match ^[a-z0-9]+(-[a-z0-9]+)*$ — lowercase letters, digits and single hyphens, no leading/trailing hyphen.",
        "Rename using only lowercase letters, numbers and hyphens, e.g. processing-pdfs."));
    }
    return out;
  },
};

const e03: Rule = {
  id: "E03",
  severity: "error",
  check(s) {
    const name = str(s.frontmatter.data["name"]) ?? "";
    if (!/(claude|anthropic)/i.test(name)) return [];
    return [
      mk("E03", "error", `name "${name}" contains a reserved word (claude/anthropic)`,
        "Anthropic reserves these words in skill names; uploads with them are rejected.",
        "Pick a name that describes the capability instead, e.g. reviewing-code."),
    ];
  },
};

const e04: Rule = {
  id: "E04",
  severity: "error",
  check(s) {
    const name = str(s.frontmatter.data["name"]);
    if (!name || !s.dirName || s.dirName === name) return [];
    return [
      mk("E04", "error", `name "${name}" does not match folder "${s.dirName}"`,
        "Tools resolve skills by folder name; a mismatch breaks installs and imports.",
        `Rename the folder to "${name}" or change name: to "${s.dirName}".`),
    ];
  },
};

const e05: Rule = {
  id: "E05",
  severity: "error",
  check(s) {
    const out: Finding[] = [];
    const raw = s.frontmatter.data["description"];
    const occurrences = s.frontmatter.keyOccurrences.filter((k) => k.key.toLowerCase() === "description");
    if (occurrences.length > 1) {
      out.push(mk("E05", "error", "description appears more than once",
        "Duplicate keys are invalid YAML per spec; parsers silently keep only one value.",
        "Keep a single description field.", { line: occurrences[1].line }));
    }
    if (raw === undefined) {
      out.push(mk("E05", "error", "Missing required field: description",
        "The description is the ONLY thing Claude sees when deciding to load your skill.",
        'Add description: "Use when …" describing what it does and when to use it.'));
      return out;
    }
    const desc = str(raw);
    if (desc === undefined) {
      out.push(mk("E05", "error", "description must be a string",
        "Non-string values fail the official validator.",
        "Quote the value so YAML treats it as a string."));
      return out;
    }
    if (desc.trim().length === 0) {
      out.push(mk("E05", "error", "description is empty",
        "An empty description means the skill will never be discovered or triggered.",
        "Describe what the skill does and when to use it."));
    }
    if (desc.length > 1024) {
      out.push(mk("E05", "error", `description is ${desc.length} chars (max 1024)`,
        "The official validator rejects descriptions over 1024 characters.",
        "Trim it — move detail into the skill body, keep triggers in the description."));
    }
    return out;
  },
};

const e06: Rule = {
  id: "E06",
  severity: "error",
  check(s) {
    const offenders: string[] = [];
    walk(s.frontmatter.data, "", offenders);
    return offenders.map((path) =>
      mk("E06", "error", `Frontmatter value at "${path}" contains < or >`,
        "Frontmatter is injected into the system prompt; angle brackets can be parsed as tags (prompt-injection surface). The official validator rejects them.",
        "Remove or rephrase without < and > characters.")
    );
  },
};

function walk(v: unknown, path: string, out: string[]): void {
  if (typeof v === "string") {
    if (v.includes("<") || v.includes(">")) out.push(path || "(root)");
  } else if (Array.isArray(v)) {
    v.forEach((item, i) => walk(item, `${path}[${i}]`, out));
  } else if (v && typeof v === "object") {
    for (const [k, val] of Object.entries(v)) walk(val, path ? `${path}.${k}` : k, out);
  }
}

const e07: Rule = {
  id: "E07",
  severity: "error",
  check(s) {
    const c = str(s.frontmatter.data["compatibility"]);
    if (c === undefined || c.length <= 500) return [];
    return [
      mk("E07", "error", `compatibility is ${c.length} chars (max 500)`,
        "The official validator caps compatibility at 500 characters.",
        "Shorten it to the environment requirements only."),
    ];
  },
};

export const frontmatterErrorRules: Rule[] = [e01, e02, e03, e04, e05, e06, e07];
