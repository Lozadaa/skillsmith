"use client";

import Link from "next/link";
import { useLocale } from "@/components/LocaleProvider";

type IconName = "anvil" | "hammer" | "crate";

function InkIcon({ name }: { name: IconName }) {
  const common = {
    width: 28,
    height: 28,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  if (name === "anvil") {
    return (
      <svg {...common}>
        <path d="M3 8h13a4 4 0 0 1-4 4H9l-1 3" />
        <path d="M16 8l4-1v3l-3 1" />
        <path d="M6 18h8" />
        <path d="M8 15h4l1 3H7z" />
      </svg>
    );
  }
  if (name === "hammer") {
    return (
      <svg {...common}>
        <path d="M14 4l6 6-3 3-6-6z" />
        <path d="M11 7L4 14a2 2 0 0 0 0 3l0 0a2 2 0 0 0 3 0l7-7" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M4 8l8-4 8 4v8l-8 4-8-4z" />
      <path d="M4 8l8 4 8-4" />
      <path d="M12 12v8" />
    </svg>
  );
}

function FeatureCard({
  title,
  href,
  body,
  icon,
}: {
  title: string;
  href: string;
  body: string;
  icon: IconName;
}) {
  return (
    <Link href={href} className="ink-panel ink-card block p-6 text-ink">
      <div className="flex items-center gap-3">
        <InkIcon name={icon} />
        <h2 className="font-display text-xl text-ink">{title}</h2>
      </div>
      <p className="mt-3 text-sm text-ink-soft">{body}</p>
    </Link>
  );
}

export default function Home() {
  const { t } = useLocale();
  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <section className="grid items-center gap-10 md:grid-cols-[1fr_45%]">
        <div>
          <h1 className="font-display text-5xl leading-tight text-ink sm:text-6xl">
            {t("home.hero.title")}
          </h1>
          <p className="mt-5 max-w-xl text-lg text-ink-soft">{t("home.hero.subtitle")}</p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link href="/workspace" className="ink-btn px-5 py-2.5 font-medium">
              {t("home.hero.cta.workspace")}
            </Link>
            <Link href="/new" className="ink-btn px-5 py-2.5 font-medium">
              {t("home.hero.cta.new")}
            </Link>
          </div>
        </div>
        <div
          role="img"
          aria-label={t("home.hero.imgAlt")}
          className="ink-hero-img ink-forge w-full max-w-md justify-self-center md:justify-self-end"
        />
      </section>

      <hr className="ink-divider my-14" />

      <section className="grid gap-5 sm:grid-cols-3">
        <FeatureCard
          title={t("home.card.inspect.title")}
          href="/workspace"
          icon="anvil"
          body={t("home.card.inspect.body")}
        />
        <FeatureCard
          title={t("home.card.forge.title")}
          href="/new"
          icon="hammer"
          body={t("home.card.forge.body")}
        />
        <FeatureCard
          title={t("home.card.import.title")}
          href="/import"
          icon="crate"
          body={t("home.card.import.body")}
        />
      </section>

      <footer className="mt-20 border-t-2 border-ink pt-6 text-center text-sm text-ink-soft">
        {t("home.footer")}
      </footer>
    </main>
  );
}
