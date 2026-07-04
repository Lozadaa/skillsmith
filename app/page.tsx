import Link from "next/link";

function FeatureCard({ title, href, body }: { title: string; href: string; body: string }) {
  return (
    <Link
      href={href}
      className="block rounded-xl border border-neutral-800 bg-neutral-900/40 p-6 transition hover:border-neutral-600"
    >
      <h2 className="text-lg font-semibold text-neutral-100">{title}</h2>
      <p className="mt-2 text-sm text-neutral-400">{body}</p>
    </Link>
  );
}

export default function Home() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <section className="text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Skillsmith</h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-neutral-400">
          Create, analyze and improve Claude Agent Skills — right in your browser.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/workspace"
            className="rounded-lg bg-sky-500 px-5 py-2.5 font-medium text-white hover:bg-sky-400"
          >
            Analyze a skill
          </Link>
          <Link
            href="/new"
            className="rounded-lg border border-neutral-700 px-5 py-2.5 font-medium text-neutral-100 hover:bg-neutral-900"
          >
            Create from template
          </Link>
        </div>
      </section>

      <section className="mt-16 grid gap-4 sm:grid-cols-3">
        <FeatureCard
          title="Analyze"
          href="/workspace"
          body="Paste, upload or drop a SKILL.md and get instant findings, a score and a token breakdown."
        />
        <FeatureCard
          title="Create"
          href="/new"
          body="A guided wizard turns your intent into a valid, well-formed skill from real-world archetypes."
        />
        <FeatureCard
          title="Import"
          href="/import"
          body="Paste any GitHub repo URL to detect its skills and load one straight into the workspace."
        />
      </section>

      <footer className="mt-20 border-t border-neutral-800 pt-6 text-center text-sm text-neutral-500">
        Static, private, no account. All analysis runs in your browser.
      </footer>
    </main>
  );
}
