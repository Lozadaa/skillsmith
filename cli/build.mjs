// Bundle the CLI + the lib/skill-lint engine into one self-contained ESM file
// with zero runtime dependencies. The published package ships only dist/, so
// `npx @lozadaa/skillsmith` downloads a tiny, install-free tarball.
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

await build({
  entryPoints: [join(here, "src/main.ts")],
  outfile: join(here, "dist/skillsmith.mjs"),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  // The engine bundles the CJS `yaml` package. In ESM output esbuild's CJS shim
  // needs a real `require`; createRequire provides one so its internal
  // `require("process")` etc. resolve instead of throwing "Dynamic require".
  banner: {
    js: "#!/usr/bin/env node\nimport{createRequire as __skillsmithCreateRequire}from'node:module';const require=__skillsmithCreateRequire(import.meta.url);",
  },
  legalComments: "none",
  logLevel: "info",
});

console.log("built dist/skillsmith.mjs");
