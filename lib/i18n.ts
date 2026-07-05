/**
 * Spanish/English i18n — flat key/value dictionary, no external deps.
 * Static-export friendly: no route locales, detection happens client-side.
 *
 * OUT OF SCOPE (documented, not swept here):
 *  - lib/skill-lint rule Finding.message / .why / .howToFix (48 engine rules — technical, stay English)
 *  - lib/wizard/archetypes.ts section titles/blurbs/placeholders/defaultContent (skill-authoring
 *    content — skills are authored in English per ecosystem convention)
 *  - lib/wizard/name.ts validateName() messages (mirror the English engine rules E02/E03 verbatim)
 *  - CATEGORIES / LICENSES option lists in StepContent (written verbatim into generated SKILL.md metadata)
 *  - server.mjs (no UI strings)
 *
 * COPY STYLE: user-facing strings avoid the em dash. Split ideas into short
 * sentences, use a colon for a label/explanation pair, or a comma for an aside.
 */

export type Locale = "en" | "es";

export const LOCALE_STORAGE_KEY = "skillsmith:locale";

export const STRINGS: Record<Locale, Record<string, string>> = {
  en: {
    // Header
    "header.brand": "Skillsmith",
    "header.nav.create": "Create",
    "header.nav.workspace": "Workspace",
    "header.nav.import": "Import",
    "header.toggleAria": "Switch language to {code}",

    // Home / landing
    "home.hero.title": "Forge better skills.",
    "home.hero.subtitle":
      "Skillsmith is the smith's bench for Claude Agent Skills. Inspect, temper and ship a spec-clean SKILL.md, entirely in your browser.",
    "home.hero.cta.workspace": "Open the workshop",
    "home.hero.cta.new": "Start forging",
    "home.hero.imgAlt": "A blacksmith hammering hot metal on an anvil, hand-drawn ink animation.",
    "home.card.inspect.title": "Inspect",
    "home.card.inspect.body":
      "Paste, upload or drop a SKILL.md and get instant findings, a proof-mark score and a token breakdown.",
    "home.card.forge.title": "Forge",
    "home.card.forge.body":
      "A guided wizard turns your intent into a valid, well-formed skill from real-world archetypes.",
    "home.card.import.title": "Import",
    "home.card.import.body":
      "Paste any GitHub repo URL to detect its skills and load one straight onto the bench.",

    // Home / CLI callout
    "home.cli.title": "Prefer the terminal?",
    "home.cli.body":
      "Skillsmith also runs in your terminal. Scan your global or project skills and temper the findings without leaving your shell, with nothing to install.",
    "home.cli.cmd": "npx @lozadaa/skillsmith",
    "home.cli.hint": "Pick a source or a custom path, inspect a skill, then press f to fix or e to export.",

    "home.footer": "Static, private, no account. All analysis runs in your browser.",

    // Import — ImportApp
    "import.title": "Import a skill from GitHub",
    "import.subtitle": "Paste a repo, gist, or owner/repo. Everything runs in your browser.",
    "import.form.label": "Repository URL",
    "import.form.placeholder": "https://github.com/owner/repo",
    "import.form.submit": "Import",
    "import.loading.resolving": "Resolving…",
    "import.error.notGithub": "That doesn't look like a GitHub repo, gist, or owner/repo.",
    "import.gist.label": "Gist skill {dirName}: score {score}.",
    "import.picker.truncated":
      "This repository is very large; GitHub truncated the file tree, so these results are partial. Import a subfolder URL (…/tree/main/path) for complete results.",
    "import.picker.found.singular": "Found {count} skill.",
    "import.picker.found.plural": "Found {count} skills.",
    "import.picker.downloadAll": "Download all (.zip)",
    "import.picker.downloading": "Downloading…",
    "import.picker.preparing": "Preparing…",
    "import.picker.doneSummary": "Done. Downloaded {count} skills, skipped {skipped} item(s).",

    // Import — TokenField
    "tokenField.hide": "Hide",
    "tokenField.toggleLabel": "GitHub token (optional)",
    "tokenField.signIn": "Sign in with GitHub",
    "tokenField.orPaste": "Or paste a personal access token to raise the rate limit and unlock private repos.",
    "tokenField.placeholder": "ghp_…",
    "tokenField.storageNote": "Stored locally only, in this browser (localStorage). Never sent anywhere but github.com.",

    // Import — UserRepos
    "userRepos.signedInAs": "Signed in as {login}",
    "userRepos.signOut": "Sign out",
    "userRepos.creating": "Creating…",
    "userRepos.createRepo": "Create skills repo",
    "userRepos.searchPlaceholder": "Search your repos…",
    "userRepos.searchAriaLabel": "Search your repos",
    "userRepos.countLabel": "{count} repos. Type to search.",
    "userRepos.noMatch": "No repos match.",
    "userRepos.private": "private",
    "userRepos.scan": "Scan",
    "userRepos.overflow.singular": "{overflow} more match. Refine your search.",
    "userRepos.overflow.plural": "{overflow} more matches. Refine your search.",

    // Import — ErrorPanel
    "errorPanel.rateLimit.title": "GitHub rate limit reached",
    "errorPanel.rateLimit.body": "Anonymous requests are limited to 60/hour. Resets around {when}.",
    "errorPanel.rateLimit.addToken": "Add a token to raise the limit to 5,000/hour",
    "errorPanel.title": "Import failed",
    "errorPanel.addToken": "Add a token",
    "errorPanel.githubError": "GitHub error {status}: {message}",
    "errorPanel.generic": "Something went wrong.",

    // Import — LinksList
    "linksList.none": "No skills and no linked GitHub repos were found in this repository.",
    "linksList.intro": "No SKILL.md here, but this looks like an awesome-list. Pick a linked repo to scan:",

    // Import — SkillPicker
    "skillPicker.headers.skill": "Skill",
    "skillPicker.headers.origin": "Origin",
    "skillPicker.headers.path": "Path",
    "skillPicker.headers.score": "Score",
    "skillPicker.headers.issues": "Issues",
    "skillPicker.symlink": "(symlink)",
    "skillPicker.root": "(root)",
    "skillPicker.notScanned": "not scanned",
    "skillPicker.open": "Open",
    "skillPicker.opening": "Opening…",

    // Import — CollectionAudit
    "collectionAudit.button": "Audit whole collection ({count} scanned)",
    "collectionAudit.title": "Collection audit: {count} skills",
    "collectionAudit.hide": "Hide",
    "collectionAudit.headers.errors": "Errors",

    // AnalyzeEntry
    "analyzeEntry.pasteLabel": "Paste a SKILL.md",
    "analyzeEntry.placeholder": "---\nname: my-skill\ndescription: Use when …\n---\n# Body",
    "analyzeEntry.analyze": "Analyze",
    "analyzeEntry.dropHint": "Drop a folder or a .zip / .skill here, or",
    "analyzeEntry.chooseFiles": "Choose files / archive",
    "analyzeEntry.chooseFolder": "Choose folder",
    "analyzeEntry.uploadFilesAria": "Upload files or archive",
    "analyzeEntry.uploadFolderAria": "Upload folder",
    "analyzeEntry.error.archiveTooBig": "That archive is over 2 MB.",
    "analyzeEntry.error.archiveEmpty": "That archive contained no readable files.",
    "analyzeEntry.error.archiveUnreadable": "Could not read that archive.",
    "analyzeEntry.error.allTooBig": "Every file was over 2 MB.",
    "analyzeEntry.error.noReadable": "No readable files found.",
    "analyzeEntry.error.skipped": "Skipped {count} file(s) over 2 MB.",
    "analyzeEntry.error.filesUnreadable": "Could not read those files.",

    // Workspace — PublishDialog
    "publishDialog.title": "Publish to GitHub",
    "publishDialog.close": "Close",
    "publishDialog.tokenLabel": "Personal access token",
    "publishDialog.tokenNote":
      "Needs a token with repo scope. Stored locally only, never sent anywhere but github.com.",
    "publishDialog.destinationLegend": "Destination",
    "publishDialog.newRepo": "New repository",
    "publishDialog.existingRepo": "Existing repository",
    "publishDialog.repoNameLabel": "Repository name",
    "publishDialog.privateRepo": "Private repository",
    "publishDialog.willCreate": "Will create github.com/{login}/{repo}",
    "publishDialog.ownerRepoLabel": "owner/repo",
    "publishDialog.autocompleteHint": " (autocompletes from your repos when signed in)",
    "publishDialog.branchLabel": "Branch (optional, defaults to the repo default)",
    "publishDialog.branchPlaceholder": "main",
    "publishDialog.pathPrefixLabel": "Path prefix",
    "publishDialog.overwriteNote": "Files already at this path will be replaced by this commit.",
    "publishDialog.commitMessageLabel": "Commit message",
    "publishDialog.publish": "Publish",
    "publishDialog.publishing": "Publishing…",
    "publishDialog.creatingCommit": "Creating commit…",
    "publishDialog.published": "Published to {url}.",
    "publishDialog.skippedSymlinks": "Skipped {count} symlink file(s): {list}",
    "publishDialog.error.nameRequired": "Enter a name for the new repository.",
    "publishDialog.error.ownerRepoRequired": "Enter the target as owner/repo or a GitHub repository URL.",
    "publishDialog.error.tokenRequired": "A token with repo scope is required to publish.",
    "publishDialog.error.rateLimit": "GitHub rate limit reached. Wait a moment, or use a token with more quota.",
    "publishDialog.error.notFound": "Repository not found. Check the owner/repo and that your token can access it.",
    "publishDialog.error.generic": "Something went wrong while publishing.",

    // Workspace — ExportButtons
    "exportButtons.zip": "Download .zip",
    "exportButtons.skill": "Download .skill",
    "exportButtons.copy": "Copy SKILL.md",
    "exportButtons.copied": "Copied!",
    "exportButtons.gateTitle": "Fix every error before exporting a package",

    // Workspace — FileTree
    "fileTree.deleteAria": "Delete {path}",
    "fileTree.addPlaceholder": "add file e.g. references/api.md",
    "fileTree.newFileAria": "New file path",

    // Workspace — NotASkillPanel
    "notASkill.title": "This doesn't look like a skill",
    "notASkill.startTemplate": "Start from template",

    // Workspace — ProfileSelect
    "profileSelect.label": "Profile",
    "profileSelect.ariaLabel": "Lint profile",
    "profileSelect.generic": "Generic (agentskills.io)",
    "profileSelect.pluginProfile": "Claude Code plugin",

    // Workspace — TokensPanel
    "tokensPanel.estimateNote":
      "~estimated. Anthropic does not publish the Claude 3+ tokenizer, so these are heuristic counts.",
    "tokensPanel.metadata.label": "Metadata (name + description)",
    "tokensPanel.metadata.note": "Loaded into every conversation: the most expensive tokens you own.",
    "tokensPanel.body.label": "SKILL.md body",
    "tokensPanel.body.note": "Loaded only when the skill triggers.",
    "tokensPanel.references.label": "references/ files",
    "tokensPanel.references.note": "Zero cost until the agent opens them. Moving content here is free.",
    "tokensPanel.scripts.label": "scripts/ files",
    "tokensPanel.scripts.note": "Executed, never loaded. Only their output consumes context.",
    "tokensPanel.unit.tok": "tok",
    "tokensPanel.unit.file": "file",
    "tokensPanel.unit.files": "files",
    "tokensPanel.total": "Total context (metadata + body + references)",

    // Workspace — FindingsPanel
    "findingsPanel.none": "No findings. This skill passes every enabled rule.",
    "findingsPanel.severity.error": "Errors",
    "findingsPanel.severity.warning": "Warnings",
    "findingsPanel.severity.suggestion": "Suggestions",
    "findingsPanel.applyFix": "Apply fix",
    "findingsPanel.whyHow": "Why it matters & how to fix",
    "findingsPanel.why": "Why: ",
    "findingsPanel.fix": "Fix: ",

    // Workspace — ScoreBadge
    "scoreBadge.band.excellent": "Excellent",
    "scoreBadge.band.good": "Good",
    "scoreBadge.band.needsWork": "Needs work",
    "scoreBadge.band.poor": "Poor",
    "scoreBadge.title": "Score {value}/100: {band}",

    // Workspace — Editor
    "editor.noFile": "No file selected.",
    "editor.ariaLabel": "Editor for {path}",

    // Workspace page
    "workspace.notASkillBadge": "Not a skill",
    "workspace.open": "Open…",
    "workspace.publish": "Publish to GitHub",
    "workspace.publishGateTitle": "Fix every error before publishing",
    "workspace.tabs.findings": "Findings",
    "workspace.tabs.tokens": "Tokens",

    // Wizard — StepIndicator
    "wizard.steps.intent": "Intent",
    "wizard.steps.archetype": "Archetype",
    "wizard.steps.description": "Description",
    "wizard.steps.content": "Content",
    "wizard.steps.review": "Review",

    // Wizard — StepIntent
    "wizard.intent.rule.title": "One skill = one capability.",
    "wizard.intent.rule.body":
      "Good: “Generate release notes from a changelog.” · Bad: “Help with engineering” (too broad; split it into focused skills).",
    "wizard.intent.what.label": "What does this skill enable?",
    "wizard.intent.what.placeholder": "Generate spec-compliant release notes from a changelog.",
    "wizard.intent.when.label": "When should it trigger?",
    "wizard.intent.when.placeholder": "A changelog or list of merged PRs needs to become a readable release note.",
    "wizard.intent.distribution.label": "Personal or shared?",
    "wizard.intent.distribution.personal": "Personal: just for my own use",
    "wizard.intent.distribution.shared": "Shared: distribute to a team or the community",

    // Wizard — StepArchetype
    "wizard.archetype.hint": "Pick the shape that matches the capability. It seeds the section scaffold on the next steps.",
    "wizard.archetype.advanced": "Advanced",

    // Wizard — StepContent
    "wizard.content.category": "Category",
    "wizard.content.none": "None",
    "wizard.content.license": "License",
    "wizard.content.version": "Version",
    "wizard.content.userInvokedOnly": "User-invoked only (disable-model-invocation)",
    "wizard.content.lines": "{count} lines",
    "wizard.content.words": "{count} words",
    "wizard.content.tokens": "~{count} tokens",
    "wizard.content.bodyWarn":
      "The body is over 400 lines. Move detail into references/ so it loads only when needed.",

    // Wizard — StepDescription / NameField
    "wizard.name.label": "Skill name (kebab-case)",
    "wizard.name.placeholder": "processing-pdfs",
    "wizard.name.valid": "Valid name.",
    "wizard.description.what.label": "What it does",
    "wizard.description.what.placeholder": "Generates release notes from a changelog",
    "wizard.description.when.label": "When to use it",
    "wizard.description.when.placeholder": "a changelog or merged-PR list needs a readable release note",
    "wizard.description.triggers.label": "Concrete trigger phrases (quoted)",
    "wizard.description.triggers.placeholder": '"write release notes", "summarize the changelog"',
    "wizard.description.negative.label": "Negative triggers (optional)",
    "wizard.description.negative.placeholder": "writing marketing copy or blog posts",
    "wizard.description.assembled": "Assembled description",
    "wizard.description.charCounter": "{count}/1024 chars",
    "wizard.description.warnLong": "Long descriptions dilute triggering. Aim for under 500 characters.",
    "wizard.description.errorHardLimit": "Over the 1024-character hard limit. The skill will be rejected, so trim it.",
    "wizard.description.personHint": "Prefer third-person, imperative phrasing over “I can” / “you can”.",
    "wizard.description.agentView": "How the agent sees it",

    // Wizard — StepReview
    "wizard.review.lintScore": "Lint score",
    "wizard.review.filesCount": "{count} file(s)",
    "wizard.review.unnamed": "unnamed",
    "wizard.review.findings": "Findings",
    "wizard.review.noFindings": "No findings. The skill is clean.",
    "wizard.review.openWorkspace": "Open in Workspace",
    "wizard.review.fixErrors":
      "Fix the {count} error finding(s) to enable download. You can still open the draft in the workspace to iterate.",

    // /new page
    "newPage.title": "Create a skill",
    "newPage.subtitle": "Answer a few questions and Skillsmith assembles a spec-compliant skill.",
    "newPage.back": "Back",
    "newPage.next": "Next",
  },
  es: {
    // Header
    "header.brand": "Skillsmith",
    "header.nav.create": "Crear",
    "header.nav.workspace": "Taller",
    "header.nav.import": "Importar",
    "header.toggleAria": "Cambiar idioma a {code}",

    // Home / landing
    "home.hero.title": "Forja mejores skills.",
    "home.hero.subtitle":
      "Skillsmith es el banco de trabajo del herrero para Claude Agent Skills. Inspecciona, templa y publica un SKILL.md limpio y conforme a la spec, todo en tu navegador.",
    "home.hero.cta.workspace": "Abrir el taller",
    "home.hero.cta.new": "Empezar a forjar",
    "home.hero.imgAlt": "Un herrero martillando metal caliente sobre un yunque, animación de tinta dibujada a mano.",
    "home.card.inspect.title": "Inspecciona",
    "home.card.inspect.body":
      "Pega, sube o arrastra un SKILL.md y obtén hallazgos al instante, una puntuación de marca de garantía y un desglose de tokens.",
    "home.card.forge.title": "Forja",
    "home.card.forge.body":
      "Un asistente guiado convierte tu intención en un skill válido y bien formado a partir de arquetipos reales.",
    "home.card.import.title": "Importa",
    "home.card.import.body":
      "Pega la URL de cualquier repo de GitHub para detectar sus skills y cargar uno directo al banco.",

    // Home / CLI callout
    "home.cli.title": "¿Prefieres la terminal?",
    "home.cli.body":
      "Skillsmith también corre en tu terminal. Escanea tus skills globales o del proyecto y templa los hallazgos sin salir de la shell, sin instalar nada.",
    "home.cli.cmd": "npx @lozadaa/skillsmith",
    "home.cli.hint": "Elige una fuente o una ruta custom, inspecciona un skill, y pulsa f para corregir o e para exportar.",

    "home.footer": "Estático, privado, sin cuenta. Todo el análisis se ejecuta en tu navegador.",

    // Import — ImportApp
    "import.title": "Importa un skill desde GitHub",
    "import.subtitle": "Pega un repo, gist, o owner/repo. Todo se ejecuta en tu navegador.",
    "import.form.label": "URL del repositorio",
    "import.form.placeholder": "https://github.com/owner/repo",
    "import.form.submit": "Importar",
    "import.loading.resolving": "Resolviendo…",
    "import.error.notGithub": "Eso no parece un repo de GitHub, un gist, ni un owner/repo.",
    "import.gist.label": "Skill de gist {dirName}: puntuación {score}.",
    "import.picker.truncated":
      "Este repositorio es muy grande; GitHub truncó el árbol de archivos, así que estos resultados son parciales. Importa la URL de una subcarpeta (…/tree/main/path) para resultados completos.",
    "import.picker.found.singular": "Se encontró {count} skill.",
    "import.picker.found.plural": "Se encontraron {count} skills.",
    "import.picker.downloadAll": "Descargar todo (.zip)",
    "import.picker.downloading": "Descargando…",
    "import.picker.preparing": "Preparando…",
    "import.picker.doneSummary": "Listo. Se descargaron {count} skills y se omitieron {skipped} elemento(s).",

    // Import — TokenField
    "tokenField.hide": "Ocultar",
    "tokenField.toggleLabel": "Token de GitHub (opcional)",
    "tokenField.signIn": "Iniciar sesión con GitHub",
    "tokenField.orPaste": "O pega un token de acceso personal para elevar el límite de solicitudes y desbloquear repos privados.",
    "tokenField.placeholder": "ghp_…",
    "tokenField.storageNote": "Se guarda solo localmente, en este navegador (localStorage). Nunca se envía a ningún sitio salvo github.com.",

    // Import — UserRepos
    "userRepos.signedInAs": "Sesión iniciada como {login}",
    "userRepos.signOut": "Cerrar sesión",
    "userRepos.creating": "Creando…",
    "userRepos.createRepo": "Crear repo de skills",
    "userRepos.searchPlaceholder": "Busca tus repos…",
    "userRepos.searchAriaLabel": "Buscar tus repos",
    "userRepos.countLabel": "{count} repos. Escribe para buscar.",
    "userRepos.noMatch": "Ningún repo coincide.",
    "userRepos.private": "privado",
    "userRepos.scan": "Escanear",
    "userRepos.overflow.singular": "{overflow} coincidencia más. Refina tu búsqueda.",
    "userRepos.overflow.plural": "{overflow} coincidencias más. Refina tu búsqueda.",

    // Import — ErrorPanel
    "errorPanel.rateLimit.title": "Límite de solicitudes de GitHub alcanzado",
    "errorPanel.rateLimit.body": "Las solicitudes anónimas están limitadas a 60/hora. Se reinicia alrededor de las {when}.",
    "errorPanel.rateLimit.addToken": "Agrega un token para elevar el límite a 5,000/hora",
    "errorPanel.title": "Error al importar",
    "errorPanel.addToken": "Agregar un token",
    "errorPanel.githubError": "Error de GitHub {status}: {message}",
    "errorPanel.generic": "Algo salió mal.",

    // Import — LinksList
    "linksList.none": "No se encontraron skills ni repos de GitHub enlazados en este repositorio.",
    "linksList.intro": "No hay SKILL.md aquí, pero esto parece una awesome-list. Elige un repo enlazado para escanear:",

    // Import — SkillPicker
    "skillPicker.headers.skill": "Skill",
    "skillPicker.headers.origin": "Origen",
    "skillPicker.headers.path": "Ruta",
    "skillPicker.headers.score": "Puntuación",
    "skillPicker.headers.issues": "Problemas",
    "skillPicker.symlink": "(symlink)",
    "skillPicker.root": "(raíz)",
    "skillPicker.notScanned": "sin escanear",
    "skillPicker.open": "Abrir",
    "skillPicker.opening": "Abriendo…",

    // Import — CollectionAudit
    "collectionAudit.button": "Auditar toda la colección ({count} escaneados)",
    "collectionAudit.title": "Auditoría de colección: {count} skills",
    "collectionAudit.hide": "Ocultar",
    "collectionAudit.headers.errors": "Errores",

    // AnalyzeEntry
    "analyzeEntry.pasteLabel": "Pega un SKILL.md",
    "analyzeEntry.placeholder": "---\nname: my-skill\ndescription: Usar cuando …\n---\n# Cuerpo",
    "analyzeEntry.analyze": "Analizar",
    "analyzeEntry.dropHint": "Suelta una carpeta o un .zip / .skill aquí, o",
    "analyzeEntry.chooseFiles": "Elegir archivos / paquete",
    "analyzeEntry.chooseFolder": "Elegir carpeta",
    "analyzeEntry.uploadFilesAria": "Subir archivos o paquete",
    "analyzeEntry.uploadFolderAria": "Subir carpeta",
    "analyzeEntry.error.archiveTooBig": "Ese paquete pesa más de 2 MB.",
    "analyzeEntry.error.archiveEmpty": "Ese paquete no contenía archivos legibles.",
    "analyzeEntry.error.archiveUnreadable": "No se pudo leer ese paquete.",
    "analyzeEntry.error.allTooBig": "Todos los archivos pesaban más de 2 MB.",
    "analyzeEntry.error.noReadable": "No se encontraron archivos legibles.",
    "analyzeEntry.error.skipped": "Se omitieron {count} archivo(s) de más de 2 MB.",
    "analyzeEntry.error.filesUnreadable": "No se pudieron leer esos archivos.",

    // Workspace — PublishDialog
    "publishDialog.title": "Publicar en GitHub",
    "publishDialog.close": "Cerrar",
    "publishDialog.tokenLabel": "Token de acceso personal",
    "publishDialog.tokenNote":
      "Necesita un token con alcance repo. Se guarda solo localmente, nunca se envía a ningún sitio salvo github.com.",
    "publishDialog.destinationLegend": "Destino",
    "publishDialog.newRepo": "Repositorio nuevo",
    "publishDialog.existingRepo": "Repositorio existente",
    "publishDialog.repoNameLabel": "Nombre del repositorio",
    "publishDialog.privateRepo": "Repositorio privado",
    "publishDialog.willCreate": "Se creará github.com/{login}/{repo}",
    "publishDialog.ownerRepoLabel": "owner/repo",
    "publishDialog.autocompleteHint": " (autocompleta desde tus repos cuando iniciaste sesión)",
    "publishDialog.branchLabel": "Rama (opcional, usa la rama por defecto del repo)",
    "publishDialog.branchPlaceholder": "main",
    "publishDialog.pathPrefixLabel": "Prefijo de ruta",
    "publishDialog.overwriteNote": "Los archivos que ya existan en esta ruta serán reemplazados por este commit.",
    "publishDialog.commitMessageLabel": "Mensaje de commit",
    "publishDialog.publish": "Publicar",
    "publishDialog.publishing": "Publicando…",
    "publishDialog.creatingCommit": "Creando commit…",
    "publishDialog.published": "Publicado en {url}.",
    "publishDialog.skippedSymlinks": "Se omitieron {count} archivo(s) symlink: {list}",
    "publishDialog.error.nameRequired": "Ingresa un nombre para el nuevo repositorio.",
    "publishDialog.error.ownerRepoRequired": "Ingresa el destino como owner/repo o una URL de repositorio de GitHub.",
    "publishDialog.error.tokenRequired": "Se requiere un token con alcance repo para publicar.",
    "publishDialog.error.rateLimit": "Límite de solicitudes de GitHub alcanzado. Espera un momento, o usa un token con más cuota.",
    "publishDialog.error.notFound": "Repositorio no encontrado. Revisa el owner/repo y que tu token pueda acceder a él.",
    "publishDialog.error.generic": "Algo salió mal al publicar.",

    // Workspace — ExportButtons
    "exportButtons.zip": "Descargar .zip",
    "exportButtons.skill": "Descargar .skill",
    "exportButtons.copy": "Copiar SKILL.md",
    "exportButtons.copied": "¡Copiado!",
    "exportButtons.gateTitle": "Corrige todos los errores antes de exportar un paquete",

    // Workspace — FileTree
    "fileTree.deleteAria": "Eliminar {path}",
    "fileTree.addPlaceholder": "agregar archivo p. ej. references/api.md",
    "fileTree.newFileAria": "Ruta del nuevo archivo",

    // Workspace — NotASkillPanel
    "notASkill.title": "Esto no parece un skill",
    "notASkill.startTemplate": "Empezar desde una plantilla",

    // Workspace — ProfileSelect
    "profileSelect.label": "Perfil",
    "profileSelect.ariaLabel": "Perfil de análisis",
    "profileSelect.generic": "Genérico (agentskills.io)",
    "profileSelect.pluginProfile": "Plugin de Claude Code",

    // Workspace — TokensPanel
    "tokensPanel.estimateNote":
      "~estimado. Anthropic no publica el tokenizador de Claude 3+, así que estos son conteos heurísticos.",
    "tokensPanel.metadata.label": "Metadatos (name + description)",
    "tokensPanel.metadata.note": "Se cargan en cada conversación: los tokens más caros que tienes.",
    "tokensPanel.body.label": "Cuerpo de SKILL.md",
    "tokensPanel.body.note": "Se carga solo cuando el skill se activa.",
    "tokensPanel.references.label": "archivos de references/",
    "tokensPanel.references.note": "Costo cero hasta que el agente los abre. Mover contenido aquí es gratis.",
    "tokensPanel.scripts.label": "archivos de scripts/",
    "tokensPanel.scripts.note": "Se ejecutan, nunca se cargan. Solo su salida consume contexto.",
    "tokensPanel.unit.tok": "tok",
    "tokensPanel.unit.file": "archivo",
    "tokensPanel.unit.files": "archivos",
    "tokensPanel.total": "Contexto total (metadata + body + references)",

    // Workspace — FindingsPanel
    "findingsPanel.none": "Sin hallazgos. Este skill pasa todas las reglas habilitadas.",
    "findingsPanel.severity.error": "Errores",
    "findingsPanel.severity.warning": "Advertencias",
    "findingsPanel.severity.suggestion": "Sugerencias",
    "findingsPanel.applyFix": "Aplicar corrección",
    "findingsPanel.whyHow": "Por qué importa y cómo corregirlo",
    "findingsPanel.why": "Por qué: ",
    "findingsPanel.fix": "Corrección: ",

    // Workspace — ScoreBadge
    "scoreBadge.band.excellent": "Excelente",
    "scoreBadge.band.good": "Bueno",
    "scoreBadge.band.needsWork": "Necesita trabajo",
    "scoreBadge.band.poor": "Deficiente",
    "scoreBadge.title": "Puntuación {value}/100: {band}",

    // Workspace — Editor
    "editor.noFile": "Ningún archivo seleccionado.",
    "editor.ariaLabel": "Editor de {path}",

    // Workspace page
    "workspace.notASkillBadge": "No es un skill",
    "workspace.open": "Abrir…",
    "workspace.publish": "Publicar en GitHub",
    "workspace.publishGateTitle": "Corrige todos los errores antes de publicar",
    "workspace.tabs.findings": "Hallazgos",
    "workspace.tabs.tokens": "Tokens",

    // Wizard — StepIndicator
    "wizard.steps.intent": "Intención",
    "wizard.steps.archetype": "Arquetipo",
    "wizard.steps.description": "Descripción",
    "wizard.steps.content": "Contenido",
    "wizard.steps.review": "Revisión",

    // Wizard — StepIntent
    "wizard.intent.rule.title": "Un skill = una capacidad.",
    "wizard.intent.rule.body":
      "Bien: “Genera notas de lanzamiento a partir de un changelog.” · Mal: “Ayuda con ingeniería” (demasiado amplio; divídelo en skills enfocados).",
    "wizard.intent.what.label": "¿Qué habilita este skill?",
    "wizard.intent.what.placeholder": "Genera notas de lanzamiento conformes a la spec a partir de un changelog.",
    "wizard.intent.when.label": "¿Cuándo debería activarse?",
    "wizard.intent.when.placeholder": "Un changelog o una lista de PRs fusionados necesita convertirse en una nota de lanzamiento legible.",
    "wizard.intent.distribution.label": "¿Personal o compartido?",
    "wizard.intent.distribution.personal": "Personal: solo para mi propio uso",
    "wizard.intent.distribution.shared": "Compartido: distribuir a un equipo o la comunidad",

    // Wizard — StepArchetype
    "wizard.archetype.hint": "Elige la forma que coincida con la capacidad. Esto siembra el andamiaje de secciones en los siguientes pasos.",
    "wizard.archetype.advanced": "Avanzado",

    // Wizard — StepContent
    "wizard.content.category": "Categoría",
    "wizard.content.none": "Ninguna",
    "wizard.content.license": "Licencia",
    "wizard.content.version": "Versión",
    "wizard.content.userInvokedOnly": "Solo invocado por el usuario (disable-model-invocation)",
    "wizard.content.lines": "{count} líneas",
    "wizard.content.words": "{count} palabras",
    "wizard.content.tokens": "~{count} tokens",
    "wizard.content.bodyWarn":
      "El cuerpo supera las 400 líneas. Mueve el detalle a references/ para que se cargue solo cuando se necesite.",

    // Wizard — StepDescription / NameField
    "wizard.name.label": "Nombre del skill (kebab-case)",
    "wizard.name.placeholder": "processing-pdfs",
    "wizard.name.valid": "Nombre válido.",
    "wizard.description.what.label": "Qué hace",
    "wizard.description.what.placeholder": "Genera notas de lanzamiento a partir de un changelog",
    "wizard.description.when.label": "Cuándo usarlo",
    "wizard.description.when.placeholder": "un changelog o una lista de PRs fusionados necesita una nota de lanzamiento legible",
    "wizard.description.triggers.label": "Frases disparadoras concretas (entre comillas)",
    "wizard.description.triggers.placeholder": '"escribir notas de lanzamiento", "resumir el changelog"',
    "wizard.description.negative.label": "Disparadores negativos (opcional)",
    "wizard.description.negative.placeholder": "escribir copy de marketing o entradas de blog",
    "wizard.description.assembled": "Descripción ensamblada",
    "wizard.description.charCounter": "{count}/1024 caracteres",
    "wizard.description.warnLong": "Las descripciones largas diluyen la activación. Apunta a menos de 500 caracteres.",
    "wizard.description.errorHardLimit": "Supera el límite estricto de 1024 caracteres. El skill será rechazado, así que recórtala.",
    "wizard.description.personHint": "Prefiere una redacción en tercera persona e imperativa en lugar de “I can” / “you can”.",
    "wizard.description.agentView": "Cómo lo ve el agente",

    // Wizard — StepReview
    "wizard.review.lintScore": "Puntuación de análisis",
    "wizard.review.filesCount": "{count} archivo(s)",
    "wizard.review.unnamed": "sin nombre",
    "wizard.review.findings": "Hallazgos",
    "wizard.review.noFindings": "Sin hallazgos. El skill está limpio.",
    "wizard.review.openWorkspace": "Abrir en el Taller",
    "wizard.review.fixErrors":
      "Corrige los {count} hallazgo(s) de error para habilitar la descarga. Aún puedes abrir el borrador en el taller para iterar.",

    // /new page
    "newPage.title": "Crea un skill",
    "newPage.subtitle": "Responde algunas preguntas y Skillsmith ensambla un skill conforme a la spec.",
    "newPage.back": "Atrás",
    "newPage.next": "Siguiente",
  },
};

/**
 * Detects the preferred locale on the client: explicit stored preference wins,
 * then the browser's language, else English. Node-safe (SSR always gets "en",
 * matching the prerendered HTML — no hydration mismatch).
 */
export function detectLocale(): Locale {
  if (typeof window === "undefined") return "en";
  try {
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (stored === "en" || stored === "es") return stored;
  } catch {
    /* storage blocked — fall through to navigator detection */
  }
  try {
    const nav = typeof navigator !== "undefined" ? navigator.language : "";
    if (nav && nav.toLowerCase().startsWith("es")) return "es";
  } catch {
    /* ignore */
  }
  return "en";
}

/** Looks up `key` for `locale`, interpolating `{token}` placeholders from `vars`. */
export function t(locale: Locale, key: string, vars?: Record<string, string | number>): string {
  const dict = STRINGS[locale] ?? STRINGS.en;
  let value = dict[key] ?? STRINGS.en[key] ?? key;
  if (vars) {
    for (const [name, v] of Object.entries(vars)) {
      value = value.split(`{${name}}`).join(String(v));
    }
  }
  return value;
}
