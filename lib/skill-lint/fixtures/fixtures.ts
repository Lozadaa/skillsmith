import type { SkillFile } from "../model";

/** Verified real-world failure: unquoted ': ' in description (boraoztunc/adversarial-review). */
export const BROKEN_YAML_COLON: SkillFile[] = [
  {
    path: "SKILL.md",
    content: `---\nname: adversarial-review\ndescription: Unlike normal code review: it leads with attacks\n---\n# Body\n`,
  },
];

/** Verified real-world case: duplicate mixed-case keys (alirezarezvani/claude-coach). */
export const DUP_MIXED_KEYS: SkillFile[] = [
  {
    path: "SKILL.md",
    content: `---\nName: claude-coach\nname: claude-coach\ndescription: Use when coaching\n---\nbody\n`,
  },
];

/** Verified real-world case: pseudo-frontmatter fixture (alirezarezvani sample-skill). */
export const NO_FRONTMATTER: SkillFile[] = [
  { path: "SKILL.md", content: `# Sample Skill\n\n**Name**: sample\n**Tier**: 1\n` },
];

/** Verified real-world case: git symlink degraded on Windows (imbad0202/academic-research-skills). */
export const SYMLINK_DEGRADED: SkillFile[] = [{ path: "SKILL.md", content: "../academic-paper" }];

/** Everything wrong at once: bad name, reserved word via name, missing description quote issues. */
export const KITCHEN_SINK_BAD: SkillFile[] = [
  {
    path: "skill.md",
    content: `---\nname: My_Claude-Skill\ncompatibility: ${"x".repeat(501)}\n---\nSee [gone](references/missing.md)\n`,
  },
  { path: "README.md", content: "should not be here" },
];
