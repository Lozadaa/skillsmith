"use client";

import { useRef, useState } from "react";
import type { SkillFile } from "@/lib/skill-lint";
import { unzipSkill } from "@/lib/zip";

const MAX_FILE_BYTES = 2 * 1024 * 1024; // spec §11

export interface AnalyzeResult {
  files: SkillFile[];
  dirName?: string;
}

/** The single top-level directory shared by every path, else "". */
function commonRoot(paths: string[]): string {
  if (paths.length === 0) return "";
  const seg = (p: string) => p.split("/")[0];
  const root = seg(paths[0]);
  return paths.every((p) => p.includes("/") && seg(p) === root) ? root : "";
}

function rootFromArchiveName(name: string): string | undefined {
  const base = name.replace(/\.(zip|skill)$/i, "").trim();
  return base || undefined;
}

export function AnalyzeEntry({ onSkill }: { onSkill: (result: AnalyzeResult) => void }) {
  const [paste, setPaste] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dirInputRef = useRef<HTMLInputElement | null>(null);

  function submitPaste() {
    if (!paste.trim()) return;
    setError(null);
    onSkill({ files: [{ path: "SKILL.md", content: paste }] });
  }

  async function readPlainFiles(list: File[]): Promise<AnalyzeResult & { rejected: number }> {
    let rejected = 0;
    const raw: { path: string; content: string }[] = [];
    for (const file of list) {
      if (file.size > MAX_FILE_BYTES) {
        rejected++;
        continue;
      }
      const rel =
        (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
      raw.push({ path: rel.replace(/\\/g, "/"), content: await file.text() });
    }
    const root = commonRoot(raw.map((r) => r.path));
    const files = raw.map((r) => ({ path: root ? r.path.slice(root.length + 1) : r.path, content: r.content }));
    return { files, dirName: root || undefined, rejected };
  }

  async function handleFiles(list: FileList | null) {
    setError(null);
    if (!list || list.length === 0) return;
    const arr = Array.from(list);

    // Single .zip / .skill → unzip.
    if (arr.length === 1 && /\.(zip|skill)$/i.test(arr[0].name)) {
      if (arr[0].size > MAX_FILE_BYTES) {
        setError("That archive is over 2 MB.");
        return;
      }
      try {
        const bytes = new Uint8Array(await arr[0].arrayBuffer());
        const files = unzipSkill(bytes);
        if (files.length === 0) {
          setError("That archive contained no readable files.");
          return;
        }
        onSkill({ files, dirName: rootFromArchiveName(arr[0].name) });
      } catch (e) {
        setError("Could not read that archive.");
        console.warn(e);
      }
      return;
    }

    // Directory / loose files.
    try {
      const { files, dirName, rejected } = await readPlainFiles(arr);
      if (files.length === 0) {
        setError(rejected > 0 ? "Every file was over 2 MB." : "No readable files found.");
        return;
      }
      if (rejected > 0) setError(`Skipped ${rejected} file(s) over 2 MB.`);
      onSkill({ files, dirName });
    } catch (e) {
      setError("Could not read those files.");
      console.warn(e);
    }
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="flex flex-col">
        <label htmlFor="analyze-paste" className="mb-1 text-sm font-medium text-neutral-300">
          Paste a SKILL.md
        </label>
        <textarea
          id="analyze-paste"
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
          placeholder={"---\nname: my-skill\ndescription: Use when …\n---\n# Body"}
          className="h-40 w-full resize-none rounded-lg border border-neutral-800 bg-neutral-950 p-3 font-mono text-xs text-neutral-100 outline-none placeholder:text-neutral-600"
        />
        <button
          type="button"
          onClick={submitPaste}
          disabled={!paste.trim()}
          className="mt-2 self-start rounded-md border border-sky-500/40 bg-sky-500/10 px-3 py-1.5 text-sm font-medium text-sky-300 hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Analyze
        </button>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void handleFiles(e.dataTransfer.files);
        }}
        className={`flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-6 text-center ${
          dragging ? "border-sky-500 bg-sky-500/5" : "border-neutral-700"
        }`}
      >
        <p className="text-sm text-neutral-400">Drop a folder or a .zip / .skill here, or</p>
        <div className="flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-md border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-sm text-neutral-100 hover:bg-neutral-700"
          >
            Choose files / archive
          </button>
          <button
            type="button"
            onClick={() => dirInputRef.current?.click()}
            className="rounded-md border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-sm text-neutral-100 hover:bg-neutral-700"
          >
            Choose folder
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          aria-label="Upload files or archive"
          onChange={(e) => void handleFiles(e.target.files)}
        />
        <input
          ref={dirInputRef}
          type="file"
          multiple
          className="hidden"
          aria-label="Upload folder"
          // webkitdirectory is a non-standard attribute not in the React types.
          // @ts-expect-error non-standard attribute
          webkitdirectory=""
          onChange={(e) => void handleFiles(e.target.files)}
        />
        {error && <p className="text-xs text-amber-400">{error}</p>}
      </div>
    </div>
  );
}
