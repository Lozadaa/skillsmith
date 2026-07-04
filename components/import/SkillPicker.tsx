"use client";
import type { PickerSkill } from "@/lib/github/importFlow";

const ORIGIN_LABEL: Record<string, string> = {
  "skills-dir": "skills-dir",
  "harness-dir": "harness-dir",
  "category-dir": "category-dir",
  root: "root",
  plugin: "plugin",
};

export default function SkillPicker({
  skills,
  busyDir,
  onOpen,
}: {
  skills: PickerSkill[];
  busyDir: string | null;
  onOpen: (skill: PickerSkill) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b text-gray-500">
            <th className="py-2 pr-4">Skill</th>
            <th className="py-2 pr-4">Origin</th>
            <th className="py-2 pr-4">Path</th>
            <th className="py-2 pr-4">Score</th>
            <th className="py-2 pr-4">Issues</th>
            <th className="py-2" />
          </tr>
        </thead>
        <tbody>
          {skills.map((s) => (
            <tr key={s.ref.dirPath || s.ref.name} className="border-b">
              <td className="py-2 pr-4 font-medium">
                {s.ref.name}
                {s.ref.viaSymlink && <span className="ml-1 text-xs text-gray-400">(symlink)</span>}
              </td>
              <td className="py-2 pr-4">
                <span className="rounded bg-gray-100 px-2 py-0.5 text-xs">{ORIGIN_LABEL[s.ref.origin]}</span>
                {s.ref.pluginName && <span className="ml-1 text-xs text-gray-500">{s.ref.pluginName}</span>}
              </td>
              <td className="py-2 pr-4 font-mono text-xs text-gray-500">{s.ref.dirPath || "(root)"}</td>
              <td className="py-2 pr-4" data-testid={`mini-score-${s.ref.dirPath || s.ref.name}`}>
                {s.scanned && s.lint.ok ? s.lint.score : "—"}
              </td>
              <td className="py-2 pr-4 text-xs">
                {s.scanned && s.lint.ok ? (
                  <span>
                    <span className="text-red-600">{s.lint.errors}E</span> /{" "}
                    <span className="text-amber-600">{s.lint.warnings}W</span>
                  </span>
                ) : (
                  <span className="text-gray-400">{s.lint.reason ?? "not scanned"}</span>
                )}
              </td>
              <td className="py-2 text-right">
                <button
                  type="button"
                  disabled={busyDir === s.ref.dirPath}
                  onClick={() => onOpen(s)}
                  className="rounded bg-blue-600 px-3 py-1 text-white disabled:opacity-50"
                >
                  {busyDir === s.ref.dirPath ? "Opening…" : "Open"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
