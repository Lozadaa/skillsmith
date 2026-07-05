# Skillsmith CLI — Diseño y arquitectura

**Fecha:** 2026-07-05
**Estado:** Borrador para revisión
**Paquete:** `@lozadaa/skillsmith` (npm, scoped público) · se corre con `npx @lozadaa/skillsmith`

## 1. Visión

Una versión de terminal de Skillsmith: una TUI bonita que corre en local **sin instalar nada**
(`npx @lozadaa/skillsmith`), deja **elegir qué skills escanear** (las globales de
`~/.claude/skills/` o las del proyecto local `./.claude/skills/` si existen) y las **analiza una a
una** reusando el motor de lint existente (`lib/skill-lint`). Muestra por skill su score, sus
hallazgos por severidad y el desglose de tokens, con toggle de perfil, aplicación de correcciones
auto-fixables y exportación del reporte.

**Principio:** el CLI no reimplementa nada del análisis. Es E/S de disco + `lib/skill-lint` +
render de terminal. El motor es la única fuente de verdad.

## 2. Alcance v1

**Incluye:**
- Selector de fuente: **Global** (`~/.claude/skills/*/`) y **Proyecto local** (`./.claude/skills/*/`, solo si existe).
- Lista de skills con barra de score, banda y nº de hallazgos.
- Vista de detalle por skill: hallazgos agrupados por severidad (con línea, por qué y cómo corregir) + desglose de tokens (metadata / body / references / scripts).
- **Toggle de perfil:** Genérico (agentskills.io) ↔ Plugin de Claude Code.
- **Aplicar fix:** para hallazgos con `AutoFix`, escribe la corrección al disco con confirmación previa.
- **Exportar:** el análisis de la fuente a JSON o Markdown.
- **Modo híbrido:** si la salida no es un TTY (pipe/CI) o se pasa `--report`, imprime un reporte plano y sale con código ≠0 si hay errores.

**No incluye (futuro):** editar/crear skills (el wizard de la web), importar desde GitHub, watch-mode, escaneo de skills de plugins (`~/.claude/plugins/`), fuente por ruta arbitraria más allá de `--path`.

## 3. Arquitectura y empaquetado

Subpaquete **`cli/`** dentro de este repo (monorepo ligero, sin workspaces):

- `cli/` importa el motor con una ruta relativa (`../lib/skill-lint`) → **una sola fuente de verdad**.
- En build, **esbuild** empaqueta CLI + motor en un único ESM `cli/dist/skillsmith.mjs`, con
  `--bundle --platform=node --format=esm --target=node20`. La TUI usa **solo built-ins de Node**
  (`node:fs`, `node:path`, `node:os`, `node:readline`, `process.stdin/stdout`), así que el bundle
  tiene **cero dependencias de runtime**.
- `cli/package.json`: `name: "@lozadaa/skillsmith"`, `bin: { "skillsmith": "dist/skillsmith.mjs" }`,
  `type: "module"`, `files: ["dist"]`, `engines.node >= 20`, `publishConfig.access: "public"`.
  `prepublishOnly` corre el build; se publica **desde `cli/`**.
- esbuild es **devDependency** (solo para construir). Lo publicado ya viene compilado → `npx` no
  instala dependencias.

Razón de descarte de alternativas: paquete/motor separado y publicado aparte (dos releases que
mantener, overkill); enviar TS y exigir runtime TS (rompe el "sin instalar nada").

## 4. Reúso del motor (`lib/skill-lint`)

API que se consume tal cual (ya exportada):
- `lintSkill(files: SkillFile[], { profile, dirName }): LintOutcome` → `{ kind, skill, findings, score, tokens }` o `{ kind: "not-a-skill", reason }`.
- `Finding.fix?: AutoFix` con `apply(files): SkillFile[]` → base de **aplicar fix**.
- `TokenReport` (metadata/body/references/scriptFiles/total) → **desglose de tokens**.
- `Profile = "generic" | "claude-code-plugin"` → **toggle de perfil**.

Notas:
- Los `AutoFix.apply` son funciones vivas en memoria: los fixes solo operan in-process. El export
  lleva los findings **sin** el `fix` (no serializable), lo cual es correcto.
- El CLI mantiene en memoria el `LintOutcome` de cada skill; re-lintea al cambiar de perfil o tras
  aplicar un fix.

## 5. Fuentes y escaneo de disco

Módulo `scan` (nuevo, en `cli/src/scan.ts`):
- Una **skill** = carpeta que contiene `SKILL.md` (case-insensitive: `SKILL.md`/`skill.md`).
- Resolución de fuentes:
  - Global: `path.join(os.homedir(), ".claude", "skills")`.
  - Local: `path.join(process.cwd(), ".claude", "skills")` (se ofrece solo si existe).
  - `--path <dir>`: trata `<dir>` como raíz de skills.
- Para cada subcarpeta con `SKILL.md`, lee recursivamente todos los archivos (SKILL.md +
  `references/` + `scripts/` + otros), construyendo `SkillFile[]` con **rutas relativas a la
  carpeta y separador `/`**. `dirName` = nombre de la carpeta (necesario para la regla name===dirName).
- Guardas: ignora symlinks fuera del árbol, límite de tamaño por archivo (p. ej. 2 MB, igual que la web) y salta binarios.

## 6. TUI

**Estado global:** `{ source, profile, skills: AnalyzedSkill[], screen, cursor, selected }`.

**Pantallas:**
1. **Fuente** — elegir Global / Proyecto local (/ ruta `--path`). Muestra cuántas skills hay en cada una; oculta Local si no existe.
2. **Lista** — filas: nombre · barra de score (bloques ANSI) · banda · `n` hallazgos. Las que no parsean como skill se marcan "no es un skill".
3. **Detalle** — cabecera con "sello" de score (stamp ASCII), hallazgos agrupados Errores → Advertencias → Sugerencias (cada uno: id, mensaje, `línea`, por qué, cómo), y desglose de tokens.

**Teclas:** `↑/↓` o `j/k` navegar · `⏎` entrar · `esc`/`←` volver · `p` cambiar perfil · `f` aplicar fix (en detalle, sobre el hallazgo con cursor si tiene fix) · `e` exportar · `?` ayuda · `q`/`Ctrl-C` salir.

**Entrada:** `process.stdin.setRawMode(true)` + parser mínimo de secuencias de escape (flechas, enter, esc). Un solo bucle de render que limpia y repinta la pantalla (alternate screen buffer `\x1b[?1049h`, restaurado al salir). Manejo de `resize` (SIGWINCH / `stdout.on('resize')`).

**Modo híbrido / no interactivo:** si `!process.stdout.isTTY` **o** `--report`, no entra en raw-mode:
imprime un reporte plano (resumen + por-skill) y termina. **Exit code:** `0` si no hay errores, `1`
si alguna skill tiene hallazgos de severidad `error`. Esto lo hace usable en CI y pipes.

**Flags:** `--source global|local` · `--path <dir>` · `--profile generic|claude-code-plugin` ·
`--report` · `--export json|md [ruta]` · `--no-color` · `--help` · `--version`.

## 7. Features v1 — detalle

- **Perfil:** `p` alterna el `Profile`; re-lintea todas las skills en memoria y repinta. Flag `--profile` fija el inicial.
- **Aplicar fix (muta disco):**
  1. En Detalle, `f` sobre un hallazgo con `fix`.
  2. Calcula `nextFiles = fix.apply(currentFiles)`; diffea qué archivos cambian.
  3. Muestra un **panel de confirmación** listando los archivos a escribir. Nada se escribe sin `y`.
  4. Al confirmar, escribe los archivos cambiados a la carpeta de la skill en disco, re-lee, re-lintea y repinta.
  - Sin fix aplicable → mensaje "sin corrección automática para este hallazgo".
- **Exportar:** `e` (o `--export`) serializa el `LintOutcome` de todas las skills de la fuente:
  - **JSON:** `{ source, profile, generatedAt, skills: [{ dirName, score, findings (sin fix), tokens }] }`.
  - **Markdown:** tabla resumen + una sección por skill. Ruta por defecto `./skillsmith-report.<ext>`.

## 8. Estética (identidad "ink/forge" en terminal)

Reúsa `docs/design/ink-style.md` mapeado a ANSI:
- **Ember** `#E8590C` (truecolor) = selección activa, barras de score altas, acentos. Fallback 16-color: amarillo/naranja brillante.
- **Ink-soft** = texto secundario/ayuda. **Severidades:** error `#C92A2A` (rojo), warning `#B7791F` (ámbar), suggestion `#2B6CB0` (azul lápiz).
- Score → **sello ASCII** (doble marco) en Detalle, color por banda (excellent/good = neutro, needs-work = ámbar, poor = rojo).
- Barras de score con bloques `█░`. Bordes de panel con box-drawing Unicode.
- **Fallbacks:** detecta truecolor (`COLORTERM`), degrada a 16 colores; `--no-color`/`NO_COLOR` desactiva ANSI; sin soporte Unicode (heurística) usa ASCII (`#`, `-`, `+`). Cuidado explícito con Windows Terminal.
- **Voz de copy:** vernáculo de taller, parco — "Inspect" (analizar), "Temper" (fix), "Ship" (export). Errores planos y directivos.

## 9. Estructura de archivos (subpaquete)

```
cli/
  package.json          # @lozadaa/skillsmith, bin, files:[dist], esbuild devDep
  build.mjs             # esbuild: bundle src/main.ts -> dist/skillsmith.mjs
  tsconfig.json         # extiende el raíz; resuelve ../lib
  src/
    main.ts             # entry: parsea flags, decide TUI vs report, orquesta
    scan.ts             # disco -> SkillFile[]; resolución de fuentes
    analyze.ts          # envuelve lintSkill por skill -> AnalyzedSkill[]
    report.ts           # modo no-TTY: render plano + exit code
    export.ts           # serialización JSON / Markdown
    tui/
      app.ts            # bucle de estado + input raw-mode
      render.ts         # pantallas (fuente/lista/detalle/confirm/ayuda)
      theme.ts          # paleta ANSI, detección de capacidades, fallbacks
      keys.ts           # parser de secuencias de escape del teclado
    fixes.ts            # aplicar AutoFix + write-back a disco
  src/*.test.ts         # tests (vitest, reutiliza la config del raíz)
  dist/                 # bundle publicado (git-ignored o commiteado; ver §12)
```

## 10. Testing

El motor ya está cubierto. Se prueba lo nuevo (vitest, misma config):
- `scan`: carpeta temporal con skills válidas/ inválidas → `SkillFile[]` correctos (rutas `/`, `dirName`, references/scripts incluidos, symlinks/binarios saltados).
- `report`: snapshot de la salida plana para una fuente fija; verificación del **exit code** (1 con errores, 0 sin).
- `fixes`: aplicar un `AutoFix` conocido sobre una carpeta temporal → archivos reescritos correctamente; re-lint refleja el cambio.
- `export`: forma del JSON y del Markdown; findings sin `fix`.
- `theme`: detección de capacidades y fallbacks (truecolor/16/no-color/ASCII) sobre entornos simulados.
- La capa raw-mode/teclado se valida a mano (matriz Windows Terminal / macOS / Linux).

## 11. Riesgos y decisiones

- **Nombre npm:** resuelto → `@lozadaa/skillsmith` (scoped, `--access public`).
- **Raw-mode/color en Windows:** mitigado con modo `--report`, alternate-screen restaurado en salida/`SIGINT`, y fallbacks de color/Unicode.
- **Duplicación del motor:** evitada por bundling desde `../lib/skill-lint`; el CLI nunca copia lógica de reglas.
- **Fixes in-process:** aceptado; export sin `fix`.

## 12. Publicación

- `npm run build` (en `cli/`) → `dist/skillsmith.mjs`. `prepublishOnly` lo garantiza.
- Publicar: `npm publish` desde `cli/` (scoped público). Verificar `npx @lozadaa/skillsmith` en limpio.
- Decisión pendiente menor: commitear `dist/` o no. Recomendado **no** commitearlo (lo genera `prepublishOnly`); mantiene el repo limpio y npx usa el tarball publicado.
