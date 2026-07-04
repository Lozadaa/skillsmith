// Minimal production server: serves the static export (out/) and provides the
// GitHub OAuth exchange that a purely static host cannot do (the client secret
// must never reach the browser). No dependencies — node built-ins only.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";

const PORT = Number(process.env.PORT || 3000);
const OUT_DIR = join(fileURLToPath(new URL(".", import.meta.url)), "out");
const CLIENT_ID = process.env.GITHUB_CLIENT_ID || "";
const CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || "";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".woff2": "font/woff2",
};

function parseCookies(header = "") {
  return Object.fromEntries(
    header
      .split(";")
      .map((p) => p.trim().split("="))
      .filter((kv) => kv.length === 2)
  );
}

/** Resolve a URL path to a file inside out/ (flat export: /workspace -> workspace.html). */
async function serveStatic(res, urlPath) {
  let p = decodeURIComponent(urlPath.split("?")[0]);
  if (p.endsWith("/")) p = p.slice(0, -1);
  if (p === "") p = "/index";
  const candidates = extname(p) ? [p] : [`${p}.html`, join(p, "index.html")];
  for (const cand of candidates) {
    const full = normalize(join(OUT_DIR, cand));
    if (!full.startsWith(OUT_DIR + sep) && full !== OUT_DIR) continue; // traversal guard
    try {
      const data = await readFile(full);
      res.writeHead(200, { "content-type": MIME[extname(full)] || "application/octet-stream" });
      res.end(data);
      return;
    } catch {
      /* try next candidate */
    }
  }
  try {
    const notFound = await readFile(join(OUT_DIR, "404.html"));
    res.writeHead(404, { "content-type": "text/html; charset=utf-8" });
    res.end(notFound);
  } catch {
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("Not found");
  }
}

function oauthLogin(res) {
  if (!CLIENT_ID) {
    res.writeHead(503, { "content-type": "text/plain" });
    res.end("GitHub sign-in is not configured on this deployment.");
    return;
  }
  const state = randomBytes(16).toString("hex");
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", CLIENT_ID);
  url.searchParams.set("scope", "repo");
  url.searchParams.set("state", state);
  res.writeHead(302, {
    location: url.toString(),
    "set-cookie": `gh_state=${state}; HttpOnly; Path=/; Max-Age=600; SameSite=Lax; Secure`,
  });
  res.end();
}

async function oauthCallback(req, res, urlObj) {
  const code = urlObj.searchParams.get("code") || "";
  const state = urlObj.searchParams.get("state") || "";
  const cookies = parseCookies(req.headers.cookie);
  const clearState = "gh_state=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax; Secure";
  if (!code || !state || cookies.gh_state !== state) {
    res.writeHead(302, { location: "/import#gh_error=state", "set-cookie": clearState });
    res.end();
    return;
  }
  try {
    const ghRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, code }),
    });
    const data = await ghRes.json();
    const token = typeof data.access_token === "string" ? data.access_token : "";
    if (!token) throw new Error("no token in exchange response");
    // Hand the token to the client and bounce to /import. The token is only
    // ever embedded in this one-shot response over TLS, never logged.
    const html = `<!doctype html><meta charset="utf-8"><script>
      localStorage.setItem("skillsmith:gh-pat", ${JSON.stringify(token)});
      location.replace("/import");
    </script>`;
    res.writeHead(200, {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "set-cookie": clearState,
    });
    res.end(html);
  } catch {
    res.writeHead(302, { location: "/import#gh_error=exchange", "set-cookie": clearState });
    res.end();
  }
}

createServer(async (req, res) => {
  const urlObj = new URL(req.url, `http://localhost:${PORT}`);
  if (urlObj.pathname === "/api/oauth/login") return oauthLogin(res);
  if (urlObj.pathname === "/api/oauth/callback") return oauthCallback(req, res, urlObj);
  return serveStatic(res, urlObj.pathname);
}).listen(PORT, () => {
  console.log(`skillsmith serving out/ on :${PORT} (oauth ${CLIENT_ID ? "enabled" : "disabled"})`);
});
