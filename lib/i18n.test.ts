// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { STRINGS, LOCALE_STORAGE_KEY, detectLocale, t, type Locale } from "./i18n";

describe("detectLocale precedence", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("falls back to English when nothing is stored and the browser is English", () => {
    vi.spyOn(window.navigator, "language", "get").mockReturnValue("en-US");
    expect(detectLocale()).toBe("en");
  });

  it("detects Spanish from the browser language when nothing is stored", () => {
    vi.spyOn(window.navigator, "language", "get").mockReturnValue("es-MX");
    expect(detectLocale()).toBe("es");
  });

  it("prefers a stored locale over the browser language", () => {
    vi.spyOn(window.navigator, "language", "get").mockReturnValue("es-ES");
    localStorage.setItem(LOCALE_STORAGE_KEY, "en");
    expect(detectLocale()).toBe("en");

    localStorage.setItem(LOCALE_STORAGE_KEY, "es");
    vi.spyOn(window.navigator, "language", "get").mockReturnValue("en-US");
    expect(detectLocale()).toBe("es");
  });

  it("ignores a garbage stored value and falls through to navigator detection", () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, "fr");
    vi.spyOn(window.navigator, "language", "get").mockReturnValue("es-AR");
    expect(detectLocale()).toBe("es");
  });

  it("is node-safe (no window) and defaults to English", () => {
    const realWindow = globalThis.window;
    // @ts-expect-error simulate an SSR/node environment
    delete globalThis.window;
    try {
      expect(detectLocale()).toBe("en");
    } finally {
      globalThis.window = realWindow;
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });
});

describe("t() interpolation", () => {
  it("substitutes a single {token}", () => {
    expect(t("en", "userRepos.signedInAs", { login: "octocat" })).toBe("Signed in as octocat");
  });

  it("substitutes multiple distinct tokens", () => {
    expect(t("en", "scoreBadge.title", { value: 92, band: "Excellent" })).toBe("Score 92/100 — Excellent");
  });

  it("returns the raw string unchanged when there are no tokens to fill", () => {
    expect(t("en", "workspace.open")).toBe("Open…");
  });

  it("falls back to the key itself when the key is missing from both locales", () => {
    expect(t("en", "nonexistent.key.for.test")).toBe("nonexistent.key.for.test");
  });
});

describe("es/en key parity", () => {
  it("every key in en exists in es and vice versa", () => {
    const enKeys = Object.keys(STRINGS.en).sort();
    const esKeys = Object.keys(STRINGS.es).sort();
    const missingFromEs = enKeys.filter((k) => !(k in STRINGS.es));
    const missingFromEn = esKeys.filter((k) => !(k in STRINGS.en));
    expect(missingFromEs).toEqual([]);
    expect(missingFromEn).toEqual([]);
    expect(esKeys).toEqual(enKeys);
  });

  it("interpolation tokens match between locales (prevents split-render drift)", () => {
    // Several components render a value inside markup by splitting on a
    // {token} in the string (e.g. publishDialog.published on {url}). If a
    // translation drops or renames the token, the interpolated value silently
    // vanishes for that locale. Every key must carry the identical {tokens}
    // in both en and es.
    const tokens = (v: string) => (v.match(/\{[a-zA-Z0-9_]+\}/g) ?? []).sort();
    for (const key of Object.keys(STRINGS.en)) {
      expect(tokens(STRINGS.es[key]), `token mismatch in "${key}"`).toEqual(tokens(STRINGS.en[key]));
    }
  });

  it("no key resolves to an empty string in either locale", () => {
    const locales: Locale[] = ["en", "es"];
    for (const locale of locales) {
      for (const [key, value] of Object.entries(STRINGS[locale])) {
        expect(value.length, `${locale}.${key} should not be empty`).toBeGreaterThan(0);
      }
    }
  });
});
