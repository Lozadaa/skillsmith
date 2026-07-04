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
      <div className="max-w-md rounded-xl border border-amber-500/30 bg-amber-500/5 p-6">
        <h2 className="text-lg font-semibold text-amber-200">This doesn&apos;t look like a skill</h2>
        <p className="mt-2 text-sm text-neutral-300">{reason}</p>
        <button
          type="button"
          onClick={onStartTemplate}
          className="mt-4 rounded-md border border-neutral-700 bg-neutral-800 px-4 py-2 text-sm text-neutral-100 hover:bg-neutral-700"
        >
          Start from template
        </button>
      </div>
    </div>
  );
}
