import Link from "next/link";

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
  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <section className="grid items-center gap-10 md:grid-cols-[1fr_45%]">
        <div>
          <h1 className="font-display text-5xl leading-tight text-ink sm:text-6xl">
            Forge better skills.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-ink-soft">
            Skillsmith is the smith&apos;s bench for Claude Agent Skills — inspect, temper and ship a
            spec-clean SKILL.md, entirely in your browser.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link href="/workspace" className="ink-btn px-5 py-2.5 font-medium">
              Open the workshop
            </Link>
            <Link href="/new" className="ink-btn px-5 py-2.5 font-medium">
              Start forging
            </Link>
          </div>
        </div>
        <img
          src="/blacksmith.png"
          alt="A blacksmith hammering hot metal on an anvil — hand-drawn in ink."
          className="w-full max-w-md justify-self-center md:justify-self-end"
        />
      </section>

      <hr className="ink-divider my-14" />

      <section className="grid gap-5 sm:grid-cols-3">
        <FeatureCard
          title="Inspect"
          href="/workspace"
          icon="anvil"
          body="Paste, upload or drop a SKILL.md and get instant findings, a proof-mark score and a token breakdown."
        />
        <FeatureCard
          title="Forge"
          href="/new"
          icon="hammer"
          body="A guided wizard turns your intent into a valid, well-formed skill from real-world archetypes."
        />
        <FeatureCard
          title="Import"
          href="/import"
          icon="crate"
          body="Paste any GitHub repo URL to detect its skills and load one straight onto the bench."
        />
      </section>

      <footer className="mt-20 border-t-2 border-ink pt-6 text-center text-sm text-ink-soft">
        Static, private, no account. All analysis runs in your browser.
      </footer>
    </main>
  );
}
