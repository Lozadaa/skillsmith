"use client";

import { useEffect, useMemo, useReducer, useState } from "react";
import {
  lintSkill,
  type Finding,
  type LintOutcome,
  type Profile,
  type SkillFile,
} from "@/lib/skill-lint";
import { takeIncomingSkill } from "@/lib/handoff";
import { DEMO_DIR_NAME, DEMO_SKILL } from "./demoSkill";

const DRAFT_KEY = "skillsmith:draft";

export interface WorkspaceState {
  files: SkillFile[];
  activePath: string;
  dirName?: string;
}

export type WorkspaceAction =
  | { type: "loadFiles"; files: SkillFile[]; dirName?: string }
  | { type: "editActive"; content: string }
  | { type: "selectFile"; path: string }
  | { type: "addFile"; path: string }
  | { type: "deleteFile"; path: string }
  | { type: "applyFix"; finding: Finding }
  | { type: "reset" };

function pickActive(files: SkillFile[], preferred: string): string {
  if (preferred && files.some((f) => f.path === preferred)) return preferred;
  if (files.some((f) => f.path === "SKILL.md")) return "SKILL.md";
  return files[0]?.path ?? "";
}

function initialState(): WorkspaceState {
  return { files: DEMO_SKILL, activePath: "SKILL.md", dirName: DEMO_DIR_NAME };
}

export function workspaceReducer(state: WorkspaceState, action: WorkspaceAction): WorkspaceState {
  switch (action.type) {
    case "loadFiles": {
      const files = action.files.length > 0 ? action.files : state.files;
      return { files, activePath: pickActive(files, ""), dirName: action.dirName };
    }
    case "editActive": {
      const files = state.files.map((f) =>
        f.path === state.activePath ? { ...f, content: action.content } : f
      );
      return { ...state, files };
    }
    case "selectFile":
      return state.files.some((f) => f.path === action.path)
        ? { ...state, activePath: action.path }
        : state;
    case "addFile": {
      const path = action.path.trim().replace(/\\/g, "/");
      if (!path || state.files.some((f) => f.path === path)) return state;
      const files = [...state.files, { path, content: "" }];
      return { ...state, files, activePath: path };
    }
    case "deleteFile": {
      if (action.path === "SKILL.md") return state; // required entry file
      const files = state.files.filter((f) => f.path !== action.path);
      if (files.length === state.files.length) return state;
      const activePath = state.activePath === action.path ? pickActive(files, "") : state.activePath;
      return { ...state, files, activePath };
    }
    case "applyFix": {
      if (!action.finding.fix) return state;
      const files = action.finding.fix.apply(state.files);
      return { ...state, files, activePath: pickActive(files, state.activePath) };
    }
    case "reset":
      return initialState();
    default:
      return state;
  }
}

/** Restore an incoming hand-off, then a saved draft, else null. Client-only. */
function restore(): { files: SkillFile[]; dirName?: string } | null {
  const incoming = takeIncomingSkill();
  if (incoming && incoming.files.length > 0) {
    return { files: incoming.files, dirName: incoming.dirName };
  }
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw) as { files: SkillFile[]; dirName?: string };
    if (draft && Array.isArray(draft.files) && draft.files.length > 0) {
      return { files: draft.files, dirName: draft.dirName };
    }
  } catch (e) {
    console.warn("useWorkspace: could not read draft", e);
  }
  return null;
}

export function useWorkspace(profile: Profile) {
  // Server + first client render use the deterministic demo (no hydration mismatch).
  const [state, dispatch] = useReducer(workspaceReducer, undefined, initialState);
  const [hydrated, setHydrated] = useState(false);

  // After mount: pull an incoming skill or a saved draft (spec §3).
  useEffect(() => {
    const restored = restore();
    if (restored) dispatch({ type: "loadFiles", files: restored.files, dirName: restored.dirName });
    setHydrated(true);
  }, []);

  // Persist the draft (300 ms debounce), only after the initial restore. Non-fatal on quota (§11).
  useEffect(() => {
    if (!hydrated) return;
    const id = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ files: state.files, dirName: state.dirName }));
      } catch (e) {
        console.warn("useWorkspace: could not save draft", e);
      }
    }, 300);
    return () => clearTimeout(id);
  }, [state.files, state.dirName, hydrated]);

  // Engine is <5 ms — no debounce needed. Recompute on files/profile/dirName change.
  const outcome: LintOutcome = useMemo(
    () => lintSkill(state.files, { profile, dirName: state.dirName }),
    [state.files, profile, state.dirName]
  );

  return { state, dispatch, outcome };
}
