"use client";

export function NotASkillPanel({
  reason,
  onStartTemplate,
}: {
  reason: string;
  onStartTemplate: () => void;
}) {
  return (
    <div className="flex flex-1 items-center justify-center p-8 text-center">
      <div className="ink-panel max-w-md p-6">
        <h2 className="font-display text-xl text-severity-warning">This doesn&apos;t look like a skill</h2>
        <p className="mt-2 text-sm text-ink">{reason}</p>
        <button
          type="button"
          onClick={onStartTemplate}
          className="ink-btn mt-4 px-4 py-2 text-sm"
        >
          Start from template
        </button>
      </div>
    </div>
  );
}
