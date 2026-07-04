// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import React, { StrictMode } from "react";
import { useWorkspace } from "./useWorkspace";
import { stashIncomingSkill } from "@/lib/handoff";

describe("useWorkspace restore under StrictMode", () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it("keeps the incoming stash even when a stale draft exists", async () => {
    localStorage.setItem(
      "skillsmith:draft",
      JSON.stringify({ files: [{ path: "SKILL.md", content: "---\nname: stale-draft\ndescription: old\n---\nold" }], dirName: "stale-draft" })
    );
    stashIncomingSkill(
      [{ path: "SKILL.md", content: "---\nname: incoming-skill\ndescription: Use when testing handoff\n---\nnew" }],
      { dirName: "incoming-skill", source: "test" }
    );
    const wrapper = ({ children }: { children: React.ReactNode }) => <StrictMode>{children}</StrictMode>;
    const { result } = renderHook(() => useWorkspace("generic"), { wrapper });
    await act(async () => { await Promise.resolve(); });
    const skillmd = result.current.state.files.find((f) => f.path === "SKILL.md");
    expect(skillmd?.content).toContain("incoming-skill");
    expect(result.current.state.dirName).toBe("incoming-skill");
  });
});
