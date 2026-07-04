import type { ParsedSkill, TokenReport } from "./model";

const CJK_RE = /[　-鿿豈-﫿가-힯]/g;
const CHARS_PER_TOKEN = 3.5;

/** Heuristic estimate — Anthropic does not publish the Claude 3+ tokenizer. */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  const cjk = text.match(CJK_RE)?.length ?? 0;
  const rest = text.length - cjk;
  return Math.ceil(rest / CHARS_PER_TOKEN + cjk);
}

export function tokenReport(skill: ParsedSkill): TokenReport {
  const name = typeof skill.frontmatter.data["name"] === "string" ? (skill.frontmatter.data["name"] as string) : "";
  const description =
    typeof skill.frontmatter.data["description"] === "string" ? (skill.frontmatter.data["description"] as string) : "";
  const metadata = estimateTokens(name) + estimateTokens(description);
  const body = estimateTokens(skill.body.raw);
  const references = skill.files
    .filter((f) => f.path !== skill.skillFile.path && f.path.toLowerCase().endsWith(".md"))
    .reduce((sum, f) => sum + estimateTokens(f.content), 0);
  const scriptFiles = skill.files.filter((f) => f.path.startsWith("scripts/")).length;
  return { metadata, body, references, scriptFiles, total: metadata + body + references };
}
