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
      <button type="button" onClick={() => onToggle(!open)} className="text-blue-600 underline">
        {open ? "Hide" : "GitHub token (optional)"}
      </button>
      {open && (
        <div className="mt-2 flex flex-col gap-1">
          <label htmlFor="gh-token" className="text-gray-600">
            Personal access token — raises the rate limit and unlocks private repos.
          </label>
          <input
            id="gh-token"
            type="password"
            value={token}
            onChange={(e) => onChange(e.target.value)}
            placeholder="ghp_…"
            className="rounded border px-2 py-1"
            autoComplete="off"
          />
          <span className="text-xs text-gray-500">Stored locally only, in this browser (localStorage). Never sent anywhere but github.com.</span>
        </div>
      )}
    </div>
  );
}
