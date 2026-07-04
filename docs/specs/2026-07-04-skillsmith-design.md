# Skillsmith — Diseño de producto y arquitectura

**Fecha:** 2026-07-04
**Estado:** Borrador para revisión
**Nombre de trabajo:** "Skillsmith" (provisional — pendiente de decisión final y verificación de dominio)

## 1. Visión

Web app pública para **crear, analizar y mejorar Agent Skills de Claude** (archivos `SKILL.md` y sus carpetas) sin escribir de más ni de menos. Tres pilares:

1. **Generador** — wizard guiado que produce skills válidas y bien formadas a partir de plantillas de arquetipos reales.
2. **Analizador** — linter estático contra las best practices oficiales de Anthropic, con severidades, explicaciones y score.
3. **Estimador de tokens** — desglose educativo del costo en contexto de cada parte de la skill.

Más una cuarta capacidad transversal: **importar skills desde cualquier repo de GitHub** con solo pegar la URL.

**Restricciones de diseño:**
- 100% estático: sin backend, sin auth, sin costos por uso. Next.js static export en Vercel.
- Todo el análisis corre en el navegador.
- Sin IA en v1 (roadmap v2: BYOK opcional).

## 2. Posicionamiento

Herramientas existentes detectadas en el ecosistema (2026-07):

| Competidor | Qué hace | Qué no hace |
|---|---|---|
| AgentSkills.io | Spec canónico + checklist de validación | No genera, no cuenta tokens, no importa repos |
| skills.sh (`npx skills add`) | Instalador multi-harness | No crea ni analiza |
| Snyk Agent Scan | Seguridad (prompt injection, tool poisoning) | Solo seguridad |
| skill-creator (oficial) | Meta-skill conversacional para crear skills | Requiere Claude, no es UI web, no ejecuta sus propios evals |
| Validadores caseros (`skill_validator.py` de alirezarezvani, `quick_validate.py` oficial) | Validación CLI local | Sin UI, sin score, sin educación |

**Hueco:** nadie combina generador + linter + tokens + import de GitHub en una web app sin fricción. La evidencia de demanda es fuerte: mantenedores serios se construyen validadores a mano, y repos populares contienen errores que un linter habría detectado (~1% con YAML roto, campos cargo-culteados, descriptions placeholder).

**Audiencia:** autores de skills — desde quien crea su primera skill hasta mantenedores de colecciones con cientos.

## 3. Arquitectura

```
skillsmith/
├── lib/
│   ├── skill-lint/          # Motor puro TypeScript — cero dependencias de UI
│   │   ├── parser.ts        # Frontmatter YAML tolerante + markdown + árbol de carpeta
│   │   ├── model.ts         # Tipos: Skill, SkillFile, Finding, Profile, Score
│   │   ├── rules/           # Una regla = { id, severidad, perfil, check(), mensaje, porQué, docsUrl }
│   │   ├── autofix.ts       # Fixes automáticos (quotear YAML, etc.)
│   │   ├── tokens.ts        # Estimador de tokens
│   │   └── score.ts         # Agregación findings → score 0-100
│   └── github/              # Importador: API REST de GitHub (CORS), detección de layouts
├── app/                     # Next.js App Router, static export
│   ├── page.tsx             # Landing (SEO)
│   ├── new/                 # Wizard
│   ├── workspace/           # Editor + lint + tokens (client-side)
│   └── import/              # Flujo de importación GitHub
└── docs/specs/              # Este documento
```

**Principio:** `lib/skill-lint` es un paquete independiente, testeable con Vitest sin UI, publicable después como CLI npm / GitHub Action (v2).

### Flujo de datos

Tres puertas de entrada convergen en el **workspace**:

| Entrada | Flujo |
|---|---|
| **Crear** | Wizard → genera estructura en memoria → workspace |
| **Analizar** | Pegar markdown / subir archivo / carpeta / .zip → parse → workspace |
| **Importar** | URL de GitHub → detección de skills → selección → fetch → workspace |

El workspace mantiene un modelo `Skill` en memoria (archivos virtuales). Cada edición re-ejecuta parse + lint + tokens (debounced). Persistencia de borradores en `localStorage`. Export: .zip, archivo `.skill` (zip renombrado, formato oficial), o copy-paste.

## 4. El parser (tolerante por diseño)

El barrido de ~1,300 skills reales en 20 repos demostró que un parser estricto rechaza skills publicadas y funcionales. Decisión: **parser tolerante que reporta, nunca crashea**.

Requisitos derivados de fallos reales observados:

1. **YAML con auto-fix:** descriptions sin comillas con `: ` interno rompen `yaml.safe_load` (~1% de skills reales). Detectar el patrón, parsear en modo recuperación y ofrecer fix de un clic (quotear el valor).
2. **Claves duplicadas / case mixto** (`Name:` + `name:`): política last-wins + warning explícito.
3. **Pre-filtro "¿parece una skill?":** requiere `---` en línea 1. Archivos sin frontmatter (fixtures reales en repos) se listan como "no analizable", no como skill rota.
4. **Symlinks:** vía API de GitHub llegan como blobs `type: symlink` (modo 120000) cuyo contenido es el path destino. Resolver y deduplicar; nunca parsear el path como contenido. Lint de portabilidad: warning si una skill se distribuye vía symlink (se rompe en Windows/zip-download).
5. **Frontmatter multi-estilo:** block scalars (`|`, `>`), quoted/plain, multi-línea, UTF-8 con CJK.
6. **Campos extendidos del ecosistema:** `metadata.*` (objeto abierto), `disable-model-invocation`, `user-invokable`, `argument-hint`, `triggers`, `compatible_tools`, `requires`, `category`, `version`, `tags`, `context` — reconocidos y clasificados (ver perfiles), nunca crash.
7. **Tolerancia de convenciones:** `references/` y `reference/`, `resources/`, `examples/`, `templates/`, `assets/`, `scripts/`, `agents/`.
8. **Archivos adyacentes no-skill:** `agents/*.md` (subagentes), `openai.yaml` (adaptadores cross-runtime), `check_*.py`, archivos sin extensión — categorizados como "relacionado, no skill".
9. Extraer todas las referencias relativas del body (links markdown + paths en backticks) para el check de links rotos y huérfanos.

## 5. El linter

### Perfiles

Dos perfiles seleccionables (default: **Genérico**):

- **Genérico (spec agentskills.io):** allowlist de frontmatter = `name, description, license, allowed-tools, metadata, compatibility`. Campo desconocido → warning.
- **Claude Code plugin:** acepta además `version`, `disable-model-invocation`, `user-invokable`, `argument-hint`; valida `plugin.json`/`marketplace.json` si existen; advierte que `allowed-tools` no es campo de skill en Claude Code.

### Catálogo de reglas v1 (~45 reglas)

**Errores (violan el spec / rompen la skill):**

| ID | Regla |
|---|---|
| E01 | Frontmatter presente, delimitado por `---`, YAML parseable como mapping |
| E02 | `name` presente, regex `^[a-z0-9]+(-[a-z0-9]+)*$` (kebab, sin hyphen inicial/final/doble), ≤64 chars |
| E03 | `name` sin "claude"/"anthropic" (reservados) |
| E04 | `name` == nombre de carpeta (cuando hay carpeta) |
| E05 | `description` presente, única, ≤1024 chars, no vacía |
| E06 | Sin `<` / `>` en ningún valor del frontmatter (recursivo — inyección al system prompt) |
| E07 | `compatibility` ≤500 chars si existe |
| E08 | Filename exacto `SKILL.md` (detectar `skill.md`, `Skill.md`, `SKILL.MD`) |
| E09 | Links/paths relativos del body resuelven a archivos existentes |
| E10 | Sin tabs en la indentación YAML |
| E11 | Sin `README.md` dentro de la carpeta de la skill |
| E12 | YAML con colon sin quotear en description (parseable en recuperación → error con auto-fix) |

**Warnings (dañan el rendimiento):**

| ID | Regla |
|---|---|
| W01 | Body ≥500 líneas o ≥5,000 palabras → mover a references/ |
| W02 | Description <20 chars o sin "qué + cuándo" |
| W03 | Description >500 chars (soft; el spec permite 1024 pero degrada el system prompt) |
| W04 | Description en primera/segunda persona (regex "I can", "You can", "Use this skill when you") |
| W05 | Description sin marcador de trigger ("Use when", "when the user", "Triggers:") |
| W06 | Body en segunda persona ("you should/need/must") → sugerir imperativo |
| W07 | `name` genérico (helper, utils, tools, data, files...) |
| W08 | Paths con backslash (Windows-style) |
| W09 | Info sensible al tiempo ("before August 2025", "as of...") |
| W10 | Referencias >1 nivel de profundidad (references que linkean references) |
| W11 | Archivos .md huérfanos (no linkeados desde SKILL.md) |
| W12 | Campo desconocido en frontmatter (según perfil) |
| W13 | Campo deprecado `when_to_use` |
| W14 | `allowed-tools` en perfil Claude Code plugin (no es campo de skill válido ahí) |
| W15 | Claves duplicadas / case mixto en frontmatter |
| W16 | Tools MCP sin calificar (`tool` vs `Server:tool`) |
| W17 | Skill distribuida vía symlink (portabilidad) |
| W18 | Basura empaquetable presente (`__pycache__`, `node_modules`, `.DS_Store`, `*.pyc`) |
| W19 | Secretos/API keys aparentes en el contenido (regex de patrones comunes) |
| W20 | Lenguaje ambiguo sin criterio ("properly", "correctly", "appropriately") |
| W21 | Densidad alta de MUST/NEVER/ALWAYS en caps sin rationale (anti-patrón oficial) |

**Sugerencias (mejoras):**

| ID | Regla |
|---|---|
| S01 | `name` en gerundio verb-first (`creating-x` > `x-creation`) |
| S02 | Description con frases trigger citables (comillas con frases de usuario reales) |
| S03 | Description sin negative triggers cuando el scope es amplio ("Do NOT use for X") |
| S04 | Body sin estructura de headings |
| S05 | Reference >300 líneas sin tabla de contenidos |
| S06 | Nombres de archivo genéricos (`doc1.md`, `file2.md`) |
| S07 | Sección "Additional Resources"/links ausente cuando hay subdirectorios con contenido |
| S08 | Enumeración excesiva de alternativas ("or...or...or") |
| S09 | Sin sección Troubleshooting/Common Issues en skills multi-paso |
| S10 | Validación crítica expresada solo en prosa → sugerir script determinista |
| S11 | `license:` en frontmatter sin `LICENSE.txt` (o viceversa) |
| S12 | Scripts sin documentación de uso |
| S13 | Contenido duplicado entre SKILL.md y references/ (heurística de near-duplicate) |
| S14 | Posible "mega-skill" (capacidades no relacionadas → sugerir split) |
| S15 | `metadata.version` ausente al re-exportar una skill editada (nudge de versionado) |

Cada finding muestra: qué está mal, **por qué importa** (cita a la best practice + fuente), cómo arreglarlo, y auto-fix cuando aplica (E12, W08, comillas, etc.).

### Lo que el linter NO valida (panel "Checklist manual")

Honestidad como feature: calidad semántica de ejemplos, terminología consistente, si fue probada con agentes reales (evals), degrees of freedom. La UI lista estos puntos como checklist manual con enlaces a la metodología oficial de evals del skill-creator.

## 6. Score

Score 0-100 con bandas (estilo Lighthouse). Fórmula inicial: base 100, errores −15 c/u, warnings −5, sugerencias −1, con pisos por categoría. **Decisión abierta para el implementador/usuario:** calibrar pesos contra el corpus real (las skills oficiales de Anthropic deben puntuar 90+; una skill con YAML roto <40). El corpus de test (sección 10) sirve de calibración.

## 7. Estimador de tokens

- Heurística calibrada (≈ chars/3.5 inglés, ajuste para código/CJK), etiquetada siempre como "~estimado" (Anthropic no publica el tokenizer de Claude 3+).
- **Desglose por nivel de progressive disclosure** (el diferenciador educativo):
  1. `name` + `description` → **siempre en contexto, en cada conversación** ("estos tokens son los más caros")
  2. Body del SKILL.md → solo al activarse
  3. `references/` → costo cero hasta que el agente los lee ("mover contenido aquí es gratis")
  4. `scripts/` → se ejecutan sin cargarse; solo su stdout consume
- Barra visual comparativa + umbrales (aviso al acercarse a 500 líneas / 5k palabras).
- Métrica agregada para colecciones: "si activas N skills, tu system prompt carga ~X tokens de metadata".

## 8. El wizard (generador)

Pasos, derivados del workflow oficial del skill-creator + los tres skill-writers:

1. **Intención** — 4 preguntas: ¿qué habilita? ¿cuándo debe activarse? ¿formato de salida esperado? ¿personal o para distribuir? Nudge "una skill = una capacidad" con ejemplo bueno/malo.
2. **Arquetipo** — galería de plantillas extraídas del corpus real:
   - Técnica/how-to simple (single-file)
   - Referencia/documentación (SKILL.md + references/ con fan-out por sección)
   - Generador de documentos (checklist de inputs → template de salida)
   - Guía de estilo/voz (tablas de swap + non-negotiables)
   - Audit/checklist (rúbrica con score)
   - Crítica graduada (niveles de revisión)
   - Persona experta (fuente citada + disambiguación "NOT for X")
   - Pipeline/orquestadora (tabla de ruteo a sub-skills) — marcada como "avanzada"
3. **Description builder** — 3 campos estructurados (qué hace / cuándo usarla / triggers concretos citables + negative triggers opcionales), concatenación automática, contador en vivo contra 1024/500, detector de tercera persona, preview de "cómo la verá el agente en el system prompt".
4. **Contenido** — editor por secciones según arquetipo, con medidor de líneas/palabras/tokens en vivo y sugerencia "mueve esta sección a references/" al acercarse al umbral. Decisión guiada de qué va en scripts/ vs references/ vs assets/.
5. **Extras** — categoría (taxonomía de 13), license, metadata.version/author, `disable-model-invocation` si es user-invoked only.
6. **Revisión y export** — lint completo (gate: no exportar con errores, como el packaging oficial), score, tokens; export .zip / `.skill` / copy. Generador opcional de README **externo** a la carpeta (posicionamiento outcome-focused + instrucciones de instalación con selector de harness destino: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, etc.) + lista de prompts de prueba trigger/no-trigger sugeridos.

## 9. Importador de GitHub

Cliente 100% browser (API REST de GitHub soporta CORS). PAT opcional en localStorage (60 → 5,000 req/h, repos privados).

**Detección de layouts (en orden):**
1. Glob recursivo `**/SKILL.md` en el árbol del repo (git trees API, `recursive=1`)
2. Si hay `.claude-plugin/marketplace.json` / `plugin.json` → atribuir skills a plugins (resolver las 4+ formas históricas del campo `skills`)
3. Rutas harness-specific (`.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.gemini/skills/`, `.github/skills/`, `.opencode/skills/`, `.windsurf/skills/`, `.agent/skills/`) y `skills/` con anidación por categoría
4. Symlinks: resolver blobs modo 120000, deduplicar espejos cross-tool
5. URL directa a subcarpeta (`/tree/main/skills/foo`) → importar solo esa skill
6. Gists → single-file
7. Repos "awesome" sin SKILL.md propio → parsear links del README y ofrecer resolución recursiva (elegir qué repo linkeado importar)

**Resultado:** listado de skills detectadas con mini-score de cada una → seleccionar → cargar al workspace (con sus references/scripts). Modo "auditar colección completa": tabla de todas las skills del repo con score y findings agregados.

## 10. Testing

- **Motor:** Vitest sobre `lib/skill-lint`. Fixtures = corpus real recolectado en la investigación: skills oficiales de Anthropic (deben pasar limpio), los 3 archivos con YAML roto verificados, el fixture sin frontmatter, symlinks, claves duplicadas, descriptions CJK de 1,270 chars. Cada regla con casos positivo/negativo.
- **Parser:** property-based light — nunca lanza excepción con input arbitrario; siempre devuelve `Skill | NotASkill` + findings.
- **Importador:** mocks de la API de GitHub con árboles reales grabados (jezweb = marketplace, boraoztunc = flat, alirezarezvani = monorepo+symlinks, mattpocock = categorizado).
- **UI:** tests de humo de los flujos (wizard completo → export válido; import → workspace).

## 11. Manejo de errores

- Parser nunca crashea: todo input produce resultado + findings (defensa en el boundary).
- GitHub: rate limit → mensaje claro con opción de PAT; repo inexistente/privado sin token → mensaje específico; árboles gigantes (>100k entradas, truncados por la API) → aviso y modo por-subcarpeta.
- Archivos enormes: cap de tamaño por archivo (p.ej. 2 MB) con aviso.
- localStorage lleno/corrupto → degradación sin pérdida del trabajo en memoria.

## 12. Fuera de alcance v1 (roadmap v2)

- IA con BYOK (redactar/mejorar contenido, simular triggering)
- Export "guardar como PR" al repo de origen (requiere OAuth backend)
- CLI npm / GitHub Action del linter
- Ejecución real de evals de triggering
- Drift-check entre copias duplicadas de skills
- Análisis de seguridad profundo (prompt injection à la Snyk) — v1 solo cubre secretos evidentes (W19)
- Cuentas de usuario / colecciones guardadas en la nube

## 13. Decisiones abiertas

1. **Nombre y dominio** del producto (working name: Skillsmith).
2. **Calibración de pesos del score** (sección 6) — se decide durante la implementación contra el corpus.
3. Idioma de la UI: inglés (audiencia global) con posible i18n después — *asumido inglés salvo indicación contraria*.
