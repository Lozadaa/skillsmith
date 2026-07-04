# Skillsmith design direction — "Inked workshop manual"

**Reference:** `public/blacksmith.png` (hand-drawn ink blacksmith, user-provided). The whole app reads as a page from a smith's inked workbook: white paper, black pen linework, and exactly one hot thing — ember orange for the metal being worked (interactive/active states).

## Tokens

### Color
| Token | Hex | Use |
|---|---|---|
| `--paper` | `#FDFCF9` | Page background (near-white sketchbook, NOT cream) |
| `--ink` | `#16130E` | Primary linework, text, borders |
| `--ink-soft` | `#5C564B` | Secondary text, hatching, captions |
| `--ember` | `#E8590C` | THE accent: interactive, links, hot states, primary buttons on hover/active. Used sparingly — the page is essentially B&W |
| `--ember-deep` | `#B93E05` | Pressed/hover-deep |
| Severity inks | error `#C92A2A`, warning `#B7791F`, suggestion = `--ink-soft` | Findings only (stamped-ink semantics) |

### Night forge (dark — follows the OS via prefers-color-scheme, no toggle)
The drawing inverts: soot paper, chalk linework, ember stays hot (it glows better at night). "Deep" accents go BRIGHTER on soot for AA contrast. The hero PNG inverts + screens so black ink becomes glowing chalk.

| Token | Dark hex |
|---|---|
| `--paper` | `#161310` (warm soot) |
| `--ink` | `#EAE4D8` (bone/chalk) |
| `--ink-soft` | `#A39A8B` |
| `--ember` | `#E8590C` (unchanged) |
| `--ember-deep` | `#FF8A4A` (brighter for AA on soot) |
| error / warning / suggestion | `#E5484D` / `#D9A03F` / `#6CA9E0` |

### Suggestion ink (third stamped ink)
Suggestions use the **editor's blue pencil**: `--color-severity-suggestion: #2B6CB0` (light) / `#6CA9E0` (dark) — chips/dots/accents only, so suggestion findings visibly stand out from soft-ink body text.

### Cursor rule
ALL interactive elements get `cursor: pointer` via a base-layer rule (buttons, role=button, selects, summary, radio/checkbox + their labels); disabled elements get `cursor: not-allowed`. Tailwind 4 preflight leaves buttons `cursor: default` — the base rule restores affordance globally.

### Type (all via next/font/google, self-hosted at build)
| Role | Face | Notes |
|---|---|---|
| Display | **IM Fell English** | Page titles, hero, the score stamp number. Antique-press irregular edges. Restraint: headings only |
| UI/Body | **Alegreya Sans** | Everything else. Humanist, calligraphic skeleton. 400/500/700 |
| Mono | **IBM Plex Mono** | Editor textarea, rule IDs, file paths, code |

### Linework system (what makes it "drawn")
- **Wobbly ink borders** on cards/panels/buttons: `border: 2px solid var(--ink); border-radius: 255px 15px 225px 15px / 15px 225px 15px 255px;` (vary the four values slightly per component class so panels don't look cloned).
- **Letterpress buttons**: paper bg, 2px ink border (wobbly), hard offset shadow `3px 3px 0 var(--ink)`; on hover the fill heats to `--ember`, text to paper, shadow stays ink. Active: translate(1px,1px) + shadow 2px.
- **Pen-stroke dividers**: 2px ink hr with slight rotate(-0.3deg) or an inline SVG stroke.
- **Disabled** = pencil: ink-soft border + text, no shadow.
- Focus visible: 2px ember outline offset 2px (accessibility floor).

### Signature element — the proof-mark score stamp
Smiths stamp their proof mark on finished work; Skillsmith stamps the score on your skill. Circular stamp ~72px: double ink ring (outer wobbly), score number in IM Fell English, band label small-caps underneath, rotated `-6deg`, color by band (excellent/good = ink, needs-work = warning ink, poor = error ink). Used in workspace header, wizard review, import mini-lint rows (smaller variant).

### Layout & motion
- Landing hero: display headline "Forge better skills." + subline, blacksmith illustration right (the PNG, ~45% width, no border — it IS the page's drawing). CTAs: letterpress buttons ("Open the workshop" → /workspace, "Start forging" → /new).
- Feature cards: three sketched panels (wobbly borders), tiny inline-SVG ink icons (anvil / hammer / crate), hover: slight rotate(-0.4deg) + shadow grows. That's the only motion beyond button presses; respect prefers-reduced-motion.
- SiteHeader: paper strip with 2px ink bottom border; wordmark "Skillsmith" in IM Fell English; nav links underline on hover with a hand-stroke (2px ink, slightly rotated).
- Panels (workspace/import/wizard): existing layout structure unchanged — restyle surfaces only.

## Implementation constraint (user-mandated)
**Styling-only pass.** Do NOT redefine, restructure, or rebuild components: same component files, same props/interfaces, same JSX structure and behavior. The restyle changes className/Tailwind values, global CSS tokens, and fonts ONLY. The design discipline applies chiefly to **spacing and margins** (consistent rhythm: 4px base scale, generous paper gutters) plus the token/linework skin above. Exceptions allowed: the landing hero content (illustration + copy, already user-approved) and purely visual markup inside ScoreBadge (the stamp look). Everything else keeps its DOM.

**New components (user-mandated):** when a genuinely new component is needed (any plan), derive it from an existing one in this codebase — copy the closest existing component's structure, prop conventions, test patterns and styling approach, then adapt. Never invent a novel pattern when a sibling component already solves the shape.

## Copy voice
Workshop vernacular, sparing: "Forge" (create), "Inspect" (lint), "Temper" (fix), "Ship" (export). Errors are plain and directive, never cute.

## Anti-default check (documented)
This direction skirts AI-default "cream + serif + terracotta". Distance kept by: near-white paper (not cream), true B&W dominance (ember is scarce), IM Fell English (not Playfair/Fraunces), and the wobbly-border + proof-stamp system as the single spent risk.
