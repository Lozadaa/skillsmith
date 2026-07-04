export type Severity = "error" | "warning" | "suggestion";
export type Profile = "generic" | "claude-code-plugin";

export interface SkillFile {
  /** Relative to the skill folder, forward slashes: "SKILL.md", "references/api.md" */
  path: string;
  content: string;
  /** true when the source (e.g. GitHub git mode 120000) marked this as a symlink */
  symlink?: boolean;
}

export interface KeyOccurrence {
  key: string; // original casing as written
  line: number; // 1-based line within SKILL.md
}

export interface Frontmatter {
  raw: string; // YAML block without the --- delimiters
  data: Record<string, unknown>; // parsed, last occurrence wins
  keyOccurrences: KeyOccurrence[];
  parseError?: { message: string; line?: number };
  /** true when the tolerant re-parse (quote unquoted colons) succeeded */
  recovered?: boolean;
  /** the repaired YAML block, present only when recovered */
  fixedRaw?: string;
}

export interface Heading {
  depth: number;
  text: string;
  line: number;
}

export interface LinkRef {
  target: string;
  line: number;
  kind: "link" | "path"; // markdown link vs backtick path
}

export interface SkillBody {
  raw: string;
  lines: string[];
  /** lines outside fenced code blocks */
  proseLines: { text: string; line: number }[];
  headings: Heading[];
  links: LinkRef[];
  wordCount: number;
}

export interface ParsedSkill {
  /** folder containing SKILL.md when known (import/upload); undefined for pasted text */
  dirName?: string;
  /** the SKILL.md filename exactly as provided (detects skill.md / Skill.md) */
  filenameAsGiven: string;
  skillFile: SkillFile;
  frontmatter: Frontmatter;
  body: SkillBody;
  files: SkillFile[]; // every file incl. SKILL.md
}

export type ParseOutcome =
  | { kind: "skill"; skill: ParsedSkill }
  | { kind: "not-a-skill"; reason: string };

export interface AutoFix {
  label: string;
  apply(files: SkillFile[]): SkillFile[];
}

export interface Finding {
  ruleId: string;
  severity: Severity;
  message: string;
  why: string;
  howToFix: string;
  file?: string; // defaults to SKILL.md
  line?: number; // 1-based
  fix?: AutoFix;
}

export interface RuleContext {
  profile: Profile;
}

export interface Rule {
  id: string;
  severity: Severity;
  /** undefined = applies to all profiles */
  profiles?: Profile[];
  check(skill: ParsedSkill, ctx: RuleContext): Finding[];
}

export interface TokenReport {
  /** name + description: loaded into EVERY conversation */
  metadata: number;
  /** SKILL.md body: loaded when the skill triggers */
  body: number;
  /** other .md files: zero cost until the agent reads them */
  references: number;
  /** count of files under scripts/ — executed, never loaded */
  scriptFiles: number;
  total: number; // metadata + body + references
}

export interface ScoreResult {
  value: number; // 0-100
  band: "excellent" | "good" | "needs-work" | "poor";
}
