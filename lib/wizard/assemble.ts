import type { SkillFile } from "@/lib/skill-lint";
import { getArchetype } from "./archetypes";
import { buildDescription, type WizardState } from "./state";

export type { WizardState };

/** kebab name -> Title Case for the body H1. */
function titleFromName(name: string): string {
  const title = name
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
  return title || "Skill";
}

/** A YAML double-quoted scalar. JSON string escaping is a valid subset. */
function yamlString(value: string): string {
  return JSON.stringify(value);
}

/** The SKILL.md body: an H1 title followed by one "## {title}" block per section. */
export function assembleBody(state: WizardState): string {
  const archetype = getArchetype(state.archetypeId);
  const blocks = archetype
    ? archetype.sections
        .map((s) => ({ title: s.title, content: (state.sections[s.id] ?? s.defaultContent).trim() }))
        .filter((b) => b.content !== "")
        .map((b) => `## ${b.title}\n\n${b.content}`)
    : [];
  return [`# ${titleFromName(state.name)}`, ...blocks].join("\n\n");
}

export function assembleSkill(state: WizardState): { files: SkillFile[]; dirName: string } {
  const archetype = getArchetype(state.archetypeId);
  const description = buildDescription(state);

  const fm: string[] = [];
  fm.push(`name: ${yamlString(state.name)}`);
  fm.push(`description: ${yamlString(description)}`);
  if (state.license && state.license !== "none") fm.push(`license: ${yamlString(state.license)}`);
  if (state.disableModelInvocation) fm.push(`disable-model-invocation: true`);

  const meta: string[] = [];
  if (state.version.trim()) meta.push(`  version: ${yamlString(state.version)}`);
  if (state.category.trim()) meta.push(`  category: ${yamlString(state.category)}`);
  if (meta.length > 0) {
    fm.push("metadata:");
    fm.push(...meta);
  }

  const frontmatter = `---\n${fm.join("\n")}\n---\n`;
  const content = `${frontmatter}\n${assembleBody(state)}\n`;

  const files: SkillFile[] = [{ path: "SKILL.md", content }];
  if (archetype) {
    for (const extra of archetype.extraFiles) {
      files.push({ path: extra.path, content: extra.content });
    }
  }
  return { files, dirName: state.name };
}
