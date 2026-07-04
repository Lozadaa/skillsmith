"use client";

import Link from "next/link";
import { useLocale } from "@/components/LocaleProvider";
import type { Locale } from "@/lib/i18n";

export function SiteHeader() {
  const { locale, setLocale, t } = useLocale();
  const other: Locale = locale === "en" ? "es" : "en";

  return (
    <header className="flex h-14 items-center gap-6 border-b-2 border-ink bg-paper px-4 text-sm">
      <Link href="/" className="ink-underline font-display text-xl text-ink hover:text-ember-deep">
        {t("header.brand")}
      </Link>
      <nav className="flex items-center gap-5 text-ink-soft">
        <Link href="/new" className="ink-underline hover:text-ember-deep">
          {t("header.nav.create")}
        </Link>
        <Link href="/workspace" className="ink-underline hover:text-ember-deep">
          {t("header.nav.workspace")}
        </Link>
        <Link href="/import" className="ink-underline hover:text-ember-deep">
          {t("header.nav.import")}
        </Link>
      </nav>
      <button
        type="button"
        onClick={() => setLocale(other)}
        aria-label={t("header.toggleAria")}
        className="ink-underline ml-auto text-ink-soft hover:text-ember-deep"
      >
        {other.toUpperCase()}
      </button>
    </header>
  );
}
