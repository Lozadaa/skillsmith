import type { SkillFile } from "@/lib/skill-lint";

/** Deterministic starter shown on first visit and by "Start from template".
 *  name === dirName ("my-first-skill") so it scores clean out of the box. */
export const DEMO_DIR_NAME = "my-first-skill";

export const DEMO_SKILL: SkillFile[] = [
  {
    path: "SKILL.md",
    content: `---
name: my-first-skill
description: Use when the user wants a starting point for authoring a Claude Agent Skill; provides a minimal, valid SKILL.md skeleton to edit and extend.
---

# My First Skill

Replace this body with instructions for the agent. Keep it short. Move long
reference material into a \`references/\` file so it costs zero tokens until read.

## When to use

Describe the concrete situations that should trigger this skill.

## Steps

1. Explain the first step.
2. Explain the second step.
`,
  },
];
