"use client";
import { GitHubError, NotFoundError, RateLimitError } from "@/lib/github/client";

export default function ErrorPanel({ error, onNeedToken }: { error: unknown; onNeedToken: () => void }) {
  if (error instanceof RateLimitError) {
    const when = error.resetEpoch ? new Date(error.resetEpoch * 1000).toLocaleTimeString() : "soon";
    return (
      <div className="rounded border border-amber-400 bg-amber-50 p-4">
        <h2 className="font-semibold">GitHub rate limit reached</h2>
        <p className="mt-1 text-sm">Anonymous requests are limited to 60/hour. Resets around {when}.</p>
        <button type="button" onClick={onNeedToken} className="mt-2 text-sm text-blue-600 underline">
          Add a token to raise the limit to 5,000/hour
        </button>
      </div>
    );
  }
  if (error instanceof NotFoundError) {
    return (
      <div className="rounded border border-red-400 bg-red-50 p-4">
        <h2 className="font-semibold">Import failed</h2>
        <p className="mt-1 text-sm">{error.message}</p>
        <button type="button" onClick={onNeedToken} className="mt-2 text-sm text-blue-600 underline">
          Add a token
        </button>
      </div>
    );
  }
  const message =
    error instanceof GitHubError
      ? `GitHub error ${error.status}: ${error.message}`
      : error instanceof Error
        ? error.message
        : "Something went wrong.";
  return (
    <div className="rounded border border-red-400 bg-red-50 p-4">
      <h2 className="font-semibold">Import failed</h2>
      <p className="mt-1 text-sm">{message}</p>
    </div>
  );
}
