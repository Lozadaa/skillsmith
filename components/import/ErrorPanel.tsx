"use client";
import { GitHubError, NotFoundError, RateLimitError } from "@/lib/github/client";
import { useLocale } from "@/components/LocaleProvider";

export default function ErrorPanel({ error, onNeedToken }: { error: unknown; onNeedToken: () => void }) {
  const { t } = useLocale();
  if (error instanceof RateLimitError) {
    const when = error.resetEpoch ? new Date(error.resetEpoch * 1000).toLocaleTimeString() : "soon";
    return (
      <div className="ink-panel p-4">
        <h2 className="font-display text-lg text-severity-warning">{t("errorPanel.rateLimit.title")}</h2>
        <p className="mt-1 text-sm text-ink">{t("errorPanel.rateLimit.body", { when })}</p>
        <button type="button" onClick={onNeedToken} className="ink-underline mt-2 text-sm text-ink hover:text-ember-deep">
          {t("errorPanel.rateLimit.addToken")}
        </button>
      </div>
    );
  }
  if (error instanceof NotFoundError) {
    return (
      <div className="ink-panel p-4">
        <h2 className="font-display text-lg text-severity-error">{t("errorPanel.title")}</h2>
        <p className="mt-1 text-sm text-ink">{error.message}</p>
        <button type="button" onClick={onNeedToken} className="ink-underline mt-2 text-sm text-ink hover:text-ember-deep">
          {t("errorPanel.addToken")}
        </button>
      </div>
    );
  }
  const message =
    error instanceof GitHubError
      ? t("errorPanel.githubError", { status: error.status, message: error.message })
      : error instanceof Error
        ? error.message
        : t("errorPanel.generic");
  return (
    <div className="ink-panel p-4">
      <h2 className="font-display text-lg text-severity-error">{t("errorPanel.title")}</h2>
      <p className="mt-1 text-sm text-ink">{message}</p>
    </div>
  );
}
