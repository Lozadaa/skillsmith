export interface ArchetypeSection {
  id: string;
  title: string;
  placeholder: string;
  defaultContent: string;
}
export interface ArchetypeFile {
  path: string;
  content: string;
}
export interface Archetype {
  id: string;
  title: string;
  blurb: string;
  advanced?: boolean;
  dirs: string[];
  sections: ArchetypeSection[];
  extraFiles: ArchetypeFile[];
}

const technique: Archetype = {
  id: "technique",
  title: "Technique / How-To",
  blurb: "A single-file skill that teaches one repeatable technique end to end.",
  dirs: [],
  sections: [
    {
      id: "overview",
      title: "Overview",
      placeholder: "State the single technique and the outcome it produces.",
      defaultContent:
        "State the single technique this skill teaches in one or two sentences. Name the concrete outcome it produces and the context where it applies. Keep the scope to one capability so the agent loads it only when relevant.",
    },
    {
      id: "when-to-use",
      title: "When To Use",
      placeholder: "List the observable conditions that should trigger the technique.",
      defaultContent:
        "List the exact situations that should trigger this technique. Prefer observable conditions over vague intent. Exclude adjacent tasks that belong to a different skill.",
    },
    {
      id: "steps",
      title: "Steps",
      placeholder: "Number the atomic, verifiable actions in order.",
      defaultContent:
        "1. Describe the first concrete action to take.\n2. Describe the second action, naming any required inputs.\n3. Continue until the outcome is reached.\n\nKeep each step atomic and independently verifiable.",
    },
    {
      id: "example",
      title: "Example",
      placeholder: "Walk through one small worked example.",
      defaultContent:
        "Walk through one worked example from input to output. Choose the smallest case that still demonstrates the technique end to end.",
    },
    {
      id: "pitfalls",
      title: "Common Pitfalls",
      placeholder: "Name the mistakes that most often break the technique.",
      defaultContent:
        "Note the mistakes that most often break this technique and how to avoid each one. Flag any step that can silently produce a wrong result.",
    },
  ],
  extraFiles: [],
};

const reference: Archetype = {
  id: "reference",
  title: "Reference / Documentation",
  blurb: "A small SKILL.md that fans out to reference files, one topic per file.",
  dirs: ["references"],
  sections: [
    {
      id: "overview",
      title: "Overview",
      placeholder: "Summarize the domain and state that detail lives under references/.",
      defaultContent:
        "Summarize the domain this reference covers and who relies on it. Keep this file small: the SKILL.md is an index and the detail lives under references/.",
    },
    {
      id: "how-to-navigate",
      title: "How To Navigate",
      placeholder: "Point to each reference file and say when to open it.",
      defaultContent:
        "Load the reference file that matches the task:\n\n- Read [concepts](references/concepts.md) for background definitions and the mental model.\n- Read [api](references/api.md) for the full field-by-field specification.\n\nOpen only the file needed for the current task to keep context small.",
    },
    {
      id: "quick-reference",
      title: "Quick Reference",
      placeholder: "The handful of high-frequency facts needed in most cases.",
      defaultContent:
        "Provide the few facts needed in most cases so the agent rarely has to open a reference file. Keep this list short and high-frequency; move anything detailed into references/.",
    },
  ],
  extraFiles: [
    {
      path: "references/concepts.md",
      content:
        "# Concepts\n\nDefine each core term precisely. Group related terms under headings and keep one concept per section so the agent can scan quickly.\n",
    },
    {
      path: "references/api.md",
      content:
        "# API Reference\n\nDocument each field or endpoint with its type, whether it is required, and a one-line description. Add a short example for any non-obvious case.\n",
    },
  ],
};

const documentGenerator: Archetype = {
  id: "document-generator",
  title: "Document Generator",
  blurb: "Collects inputs against a checklist, then emits a fixed output template.",
  dirs: [],
  sections: [
    {
      id: "overview",
      title: "Overview",
      placeholder: "Name the document type produced and the decision it supports.",
      defaultContent:
        "Describe the document type this skill produces and the decision it supports. Generate consistent structure on every run by following the template below.",
    },
    {
      id: "input-checklist",
      title: "Input Checklist",
      placeholder: "The inputs to gather before drafting anything.",
      defaultContent:
        "Gather every input before drafting:\n\n- [ ] Primary subject or title\n- [ ] Target audience and reading level\n- [ ] Required sections and their order\n- [ ] Source facts or data to include\n\nRequest any missing input rather than inventing it.",
    },
    {
      id: "output-template",
      title: "Output Template",
      placeholder: "The exact structure of the generated document.",
      defaultContent:
        "Produce the document using this structure:\n\n```\n# {{title}}\n\n## Summary\n{{one-paragraph summary}}\n\n## Details\n{{body organized by the required sections}}\n\n## Next Steps\n{{concrete follow-up actions}}\n```\n\nReplace every placeholder and drop any section that has no content.",
    },
    {
      id: "quality-bar",
      title: "Quality Bar",
      placeholder: "The conditions that make a draft unacceptable.",
      defaultContent:
        "Reject a draft that leaves placeholders unfilled, omits a required section, or contradicts a source fact. Prefer concise prose over padding.",
    },
  ],
  extraFiles: [],
};

const styleGuide: Archetype = {
  id: "style-guide",
  title: "Style / Voice Guide",
  blurb: "Enforces a voice with swap tables and a short list of non-negotiables.",
  dirs: [],
  sections: [
    {
      id: "overview",
      title: "Overview",
      placeholder: "Define the voice and the surfaces it applies to.",
      defaultContent:
        "Define the voice this guide enforces and the surfaces it applies to. Apply every rule below when drafting or editing.",
    },
    {
      id: "non-negotiables",
      title: "Non-Negotiables",
      placeholder: "Rules that apply without exception.",
      defaultContent:
        "Apply these rules without exception:\n\n- Lead with the conclusion, then support it.\n- Keep sentences under 25 words where possible.\n- Cut any sentence that adds no information.",
    },
    {
      id: "swap-table",
      title: "Swap Table",
      placeholder: "Phrasings to replace with better phrasings.",
      defaultContent:
        "Replace the left phrasing with the right phrasing:\n\n| Avoid | Prefer |\n| --- | --- |\n| passive hedging | direct claims |\n| filler adverbs | precise verbs |\n| jargon without context | plain language |",
    },
    {
      id: "before-and-after",
      title: "Before And After",
      placeholder: "One rewrite per rule showing the contrast.",
      defaultContent:
        "Show one rewrite per rule. Present the weak version first, then the corrected version, so the contrast is explicit.",
    },
  ],
  extraFiles: [],
};

const auditChecklist: Archetype = {
  id: "audit-checklist",
  title: "Audit Checklist",
  blurb: "Scores an artifact against a numeric rubric and reports remediation.",
  dirs: [],
  sections: [
    {
      id: "overview",
      title: "Overview",
      placeholder: "State what is evaluated and the standard measured against.",
      defaultContent:
        "State what this audit evaluates and the standard it measures against. Produce a numeric score plus actionable findings on every run.",
    },
    {
      id: "rubric",
      title: "Scoring Rubric",
      placeholder: "The dimensions and their scoring bands.",
      defaultContent:
        "Score each dimension from 0 to 5:\n\n| Dimension | 0-1 | 2-3 | 4-5 |\n| --- | --- | --- | --- |\n| Completeness | major gaps | minor gaps | thorough |\n| Accuracy | frequent errors | few errors | verified |\n| Clarity | hard to follow | mostly clear | crisp |",
    },
    {
      id: "procedure",
      title: "Audit Procedure",
      placeholder: "The ordered steps of the audit.",
      defaultContent:
        "1. Collect the artifact and its context.\n2. Score each rubric dimension with a one-line justification.\n3. Sum the scores and map the total to a grade band.\n4. List the highest-impact fixes first.",
    },
    {
      id: "report-format",
      title: "Report Format",
      placeholder: "How to present the score and findings.",
      defaultContent:
        "Report the total score, the per-dimension breakdown, and the top three remediation actions. Cite specific evidence for every deduction.",
    },
  ],
  extraFiles: [],
};

const graduatedCritique: Archetype = {
  id: "graduated-critique",
  title: "Graduated Critique",
  blurb: "Reviews at selectable depths, matching effort to the stakes.",
  dirs: [],
  sections: [
    {
      id: "overview",
      title: "Overview",
      placeholder: "Describe what is critiqued and why graduated depth matters.",
      defaultContent:
        "Describe what this skill critiques and why graduated depth matters. Match review effort to the stakes of the artifact.",
    },
    {
      id: "levels",
      title: "Review Levels",
      placeholder: "The available depths and what each covers.",
      defaultContent:
        "Offer three depths of review:\n\n- Level 1 — Surface: correctness, obvious errors, and blockers only.\n- Level 2 — Structural: organization, completeness, and internal consistency.\n- Level 3 — Deep: assumptions, edge cases, and adversarial failure modes.",
    },
    {
      id: "selecting-level",
      title: "Selecting A Level",
      placeholder: "How to pick the right depth.",
      defaultContent:
        "Choose the shallowest level that meets the request. Escalate only when the artifact is high-stakes or the requester asks for more depth.",
    },
    {
      id: "critique-output",
      title: "Critique Output",
      placeholder: "How findings are grouped and delivered.",
      defaultContent:
        "Group findings by level and severity. Lead with blockers, then improvements, then optional polish. Attach a concrete fix to each finding.",
    },
  ],
  extraFiles: [],
};

const expertPersona: Archetype = {
  id: "expert-persona",
  title: "Expert Persona",
  blurb: "Speaks as a cited domain expert with explicit NOT-for boundaries.",
  dirs: ["references"],
  sections: [
    {
      id: "persona",
      title: "Persona",
      placeholder: "The named expert voice and its credential.",
      defaultContent:
        "Adopt the voice of a named domain expert with a specific point of view. State the credential or tradition the persona draws on. Stay in character while remaining accurate.",
    },
    {
      id: "scope",
      title: "Scope And Boundaries",
      placeholder: "What is in scope, plus explicit NOT-for cases.",
      defaultContent:
        "Answer only questions inside the stated domain.\n\nNOT for: general chit-chat, unrelated domains, or advice that requires a licensed professional. Redirect out-of-scope requests instead of guessing.",
    },
    {
      id: "method",
      title: "Method",
      placeholder: "How the persona reasons and grounds claims.",
      defaultContent:
        "Reason from first principles in the domain, then translate to plain guidance. Ground every claim in the cited sources rather than unstated opinion.",
    },
    {
      id: "sources",
      title: "Sources",
      placeholder: "Point to the cited source material.",
      defaultContent:
        "Base answers on the material catalogued in [sources](references/sources.md). Cite the specific source when making a non-obvious claim.",
    },
  ],
  extraFiles: [
    {
      path: "references/sources.md",
      content:
        "# Sources\n\nList the authoritative works, standards, or datasets this persona relies on. Give each a one-line note on what it authorizes the persona to claim.\n",
    },
  ],
};

const pipelineOrchestrator: Archetype = {
  id: "pipeline-orchestrator",
  title: "Pipeline / Orchestrator",
  blurb: "Routes a multi-step request to focused sub-skills. Advanced.",
  advanced: true,
  dirs: [],
  sections: [
    {
      id: "overview",
      title: "Overview",
      placeholder: "Describe the workflow coordinated and keep this file as the routing layer.",
      defaultContent:
        "Describe the multi-step workflow this skill coordinates. Delegate each step to a focused sub-skill and keep this file as the routing layer only. This archetype is advanced: prefer a single-capability skill unless orchestration is genuinely required.",
    },
    {
      id: "routing-table",
      title: "Routing Table",
      placeholder: "Signals mapped to sub-skills.",
      defaultContent:
        "Route each request to the sub-skill that owns it:\n\n| Signal in request | Route to sub-skill |\n| --- | --- |\n| data cleaning or parsing | data-preparation |\n| chart or dashboard | data-visualization |\n| written summary | report-writing |\n\nMatch the most specific signal first.",
    },
    {
      id: "handoff-contract",
      title: "Handoff Contract",
      placeholder: "What to pass to each sub-skill.",
      defaultContent:
        "Pass a compact brief to each sub-skill: the goal, the inputs, and the expected output shape. Preserve prior results so downstream steps do not re-derive them.",
    },
    {
      id: "fallback",
      title: "Fallback",
      placeholder: "How to handle unroutable requests.",
      defaultContent:
        "Handle requests that match no route by asking one clarifying question, then routing again. Never silently drop a request.",
    },
  ],
  extraFiles: [],
};

export const archetypes: Archetype[] = [
  technique,
  reference,
  documentGenerator,
  styleGuide,
  auditChecklist,
  graduatedCritique,
  expertPersona,
  pipelineOrchestrator,
];

export function getArchetype(id: string | null): Archetype | undefined {
  if (!id) return undefined;
  return archetypes.find((a) => a.id === id);
}
