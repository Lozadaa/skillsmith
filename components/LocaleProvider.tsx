"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { LOCALE_STORAGE_KEY, detectLocale, t as translate, type Locale } from "@/lib/i18n";

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

// Default context (no Provider mounted) degrades to English — this lets
// components that call useLocale() render correctly in isolation (e.g. unit
// tests that mount a single component without wrapping it in LocaleProvider).
const defaultValue: LocaleContextValue = {
  locale: "en",
  setLocale: () => {},
  t: (key, vars) => translate("en", key, vars),
};

const LocaleContext = createContext<LocaleContextValue>(defaultValue);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  // Server + first client render always render "en" — matches the prerendered
  // HTML, so there is no hydration mismatch (same pattern as useWorkspace's
  // restore-after-mount effect).
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    setLocaleState(detectLocale());
  }, []);

  // Keep <html lang> in sync so screen readers and search engines announce the
  // page in the language actually shown. Runs client-side only (the prerendered
  // markup ships lang="en"), so it never causes a hydration mismatch.
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, next);
    } catch {
      /* storage blocked — degrade to in-memory only */
    }
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars),
    [locale]
  );

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  return useContext(LocaleContext);
}
