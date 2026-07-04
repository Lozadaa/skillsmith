import { zipSync, unzipSync, strToU8, strFromU8 } from "fflate";
import type { SkillFile } from "./skill-lint/model";

/** Zip a skill's virtual files. Every entry is prefixed with `${rootDir}/`. */
export function zipSkill(files: SkillFile[], rootDir: string): Uint8Array {
  const prefix = rootDir ? `${rootDir}/` : "";
  const entries: Record<string, Uint8Array> = {};
  for (const f of files) {
    entries[`${prefix}${f.path}`] = strToU8(f.content);
  }
  return zipSync(entries, { level: 6 });
}

/** Unzip into SkillFile[]. Directory entries are skipped and a single shared
 *  root directory (as produced by every download-as-zip) is stripped. */
export function unzipSkill(data: Uint8Array): SkillFile[] {
  const raw = unzipSync(data);
  const paths = Object.keys(raw)
    .map((p) => p.replace(/\\/g, "/"))
    .filter((p) => !p.endsWith("/")); // skip directory entries
  const root = commonRoot(paths);
  const files: SkillFile[] = [];
  for (const p of paths) {
    const rel = root ? p.slice(root.length + 1) : p;
    if (!rel) continue;
    files.push({ path: rel, content: strFromU8(raw[p.replace(/\//g, "/")] ?? raw[p]) });
  }
  return files;
}

/** Bundle multiple skills into one archive: each group nests under `skills/<name>/`. */
export function zipCollection(groups: { name: string; files: SkillFile[] }[]): Uint8Array {
  const entries: Record<string, Uint8Array> = {};
  for (const g of groups) {
    for (const f of g.files) {
      entries[`skills/${g.name}/${f.path}`] = strToU8(f.content);
    }
  }
  return zipSync(entries, { level: 6 });
}

/** The single top-level directory shared by every path, else "". */
function commonRoot(paths: string[]): string {
  if (paths.length === 0) return "";
  const seg = (p: string) => p.split("/")[0];
  const root = seg(paths[0]);
  return paths.every((p) => p.includes("/") && seg(p) === root) ? root : "";
}

/** Browser-only: trigger a file download from bytes or a string. */
export function downloadBlob(filename: string, data: Uint8Array | string, mime: string): void {
  const parts: BlobPart[] = [typeof data === "string" ? data : new Uint8Array(data)];
  const blob = new Blob(parts, { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
