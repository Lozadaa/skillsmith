import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="flex h-14 items-center gap-6 border-b border-neutral-800 bg-neutral-950 px-4 text-sm">
      <Link href="/" className="font-semibold text-neutral-100">
        Skillsmith
      </Link>
      <nav className="flex items-center gap-4 text-neutral-400">
        <Link href="/new" className="hover:text-neutral-100">
          Create
        </Link>
        <Link href="/workspace" className="hover:text-neutral-100">
          Workspace
        </Link>
        <Link href="/import" className="hover:text-neutral-100">
          Import
        </Link>
      </nav>
    </header>
  );
}
