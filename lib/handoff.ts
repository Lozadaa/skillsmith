import type { SkillFile } from "./skill-lint/model";

const KEY = "skillsmith:incoming";

export interface IncomingSkill {
  files: SkillFile[];
  dirName?: string;
  source?: string;
}

/** Default storage: the browser sessionStorage when present, else undefined (SSR/tests). */
function defaultStorage(): Storage | undefined {
  return typeof globalThis !== "undefined" &&
    (globalThis as { sessionStorage?: Storage }).sessionStorage
    ? (globalThis as unknown as { sessionStorage: Storage }).sessionStorage
    : undefined;
}

/** Stash a skill for the workspace to pick up after navigation. Plans 4/5 call this. */
export function stashIncomingSkill(
  files: SkillFile[],
  opts: { dirName?: string; source?: string } = {},
  storage: Storage | undefined = defaultStorage()
): void {
  if (!storage) return;
  try {
    const payload: IncomingSkill = { files, dirName: opts.dirName, source: opts.source };
    storage.setItem(KEY, JSON.stringify(payload));
  } catch (e) {
    console.warn("stashIncomingSkill: could not write sessionStorage", e);
  }
}

/** Read AND remove the stashed skill. Returns null when absent or corrupt. */
export function takeIncomingSkill(
  storage: Storage | undefined = defaultStorage()
): IncomingSkill | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(KEY);
    if (!raw) return null;
    storage.removeItem(KEY);
    const parsed = JSON.parse(raw) as IncomingSkill;
    if (!parsed || !Array.isArray(parsed.files)) return null;
    return parsed;
  } catch (e) {
    console.warn("takeIncomingSkill: could not read sessionStorage", e);
    return null;
  }
}
