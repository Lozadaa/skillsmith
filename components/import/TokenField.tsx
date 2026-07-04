"use client";

export default function TokenField({
  token,
  onChange,
  open,
  onToggle,
}: {
  token: string;
  onChange: (t: string) => void;
  open: boolean;
  onToggle: (open: boolean) => void;
}) {
  return (
    <div className="mt-2 text-sm">
      <button type="button" onClick={() => onToggle(!open)} className="ink-underline text-ink hover:text-ember">
        {open ? "Hide" : "GitHub token (optional)"}
      </button>
      {open && (
        <div className="mt-2 flex flex-col gap-1">
          <label htmlFor="gh-token" className="text-ink-soft">
            Personal access token — raises the rate limit and unlocks private repos.
          </label>
          <input
            id="gh-token"
            type="password"
            value={token}
            onChange={(e) => onChange(e.target.value)}
            placeholder="ghp_…"
            className="rounded border-2 border-ink bg-paper px-2 py-1 text-ink outline-none focus:border-ember"
            autoComplete="off"
          />
          <span className="text-xs text-ink-soft">Stored locally only, in this browser (localStorage). Never sent anywhere but github.com.</span>
        </div>
      )}
    </div>
  );
}
