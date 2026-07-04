import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="flex h-14 items-center gap-6 border-b-2 border-ink bg-paper px-4 text-sm">
      <Link href="/" className="ink-underline font-display text-xl text-ink hover:text-ember">
        Skillsmith
      </Link>
      <nav className="flex items-center gap-5 text-ink-soft">
        <Link href="/new" className="ink-underline hover:text-ember">
          Create
        </Link>
        <Link href="/workspace" className="ink-underline hover:text-ember">
          Workspace
        </Link>
        <Link href="/import" className="ink-underline hover:text-ember">
          Import
        </Link>
      </nav>
    </header>
  );
}
