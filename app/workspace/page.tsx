"use client";

import { useState } from "react";
import type { Profile } from "@/lib/skill-lint";
import { useWorkspace } from "@/components/workspace/useWorkspace";
import { FindingsPanel } from "@/components/workspace/FindingsPanel";
import { TokensPanel } from "@/components/workspace/TokensPanel";
import { FileTree } from "@/components/workspace/FileTree";
import { Editor } from "@/components/workspace/Editor";
import { ScoreBadge } from "@/components/workspace/ScoreBadge";
import { ProfileSelect } from "@/components/workspace/ProfileSelect";
import { ExportButtons } from "@/components/workspace/ExportButtons";
import { NotASkillPanel } from "@/components/workspace/NotASkillPanel";
import { AnalyzeEntry } from "@/components/AnalyzeEntry";

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium ${
        active ? "border-b-2 border-sky-500 text-neutral-100" : "text-neutral-400 hover:text-neutral-200"
      }`}
    >
      {children}
    </button>
  );
}

export default function WorkspacePage() {
  const [profile, setProfile] = useState<Profile>("generic");
  const [tab, setTab] = useState<"findings" | "tokens">("findings");
  const [showOpen, setShowOpen] = useState(false);
  const { state, dispatch, outcome } = useWorkspace(profile);

  const activeFile = state.files.find((f) => f.path === state.activePath);
  const skillName =
    outcome.kind === "skill" && typeof outcome.skill.frontmatter.data["name"] === "string"
      ? (outcome.skill.frontmatter.data["name"] as string)
      : undefined;
  const hasError = outcome.kind === "skill" && outcome.findings.some((f) => f.severity === "error");

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col bg-neutral-950 text-neutral-100">
      <header className="flex flex-wrap items-center gap-3 border-b border-neutral-800 px-4 py-2">
        {outcome.kind === "skill" ? (
          <ScoreBadge score={outcome.score} />
        ) : (
          <span className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-sm text-amber-300">
            Not a skill
          </span>
        )}
        <ProfileSelect value={profile} onChange={setProfile} />
        <button
          type="button"
          onClick={() => setShowOpen((v) => !v)}
          className="rounded-md border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-700"
        >
          Open…
        </button>
        <div className="ml-auto">
          <ExportButtons
            files={state.files}
            dirName={state.dirName}
            skillName={skillName}
            hasError={hasError}
          />
        </div>
      </header>

      {showOpen && (
        <div className="border-b border-neutral-800 bg-neutral-900/60 p-4">
          <AnalyzeEntry
            onSkill={({ files, dirName }) => {
              dispatch({ type: "loadFiles", files, dirName });
              setShowOpen(false);
            }}
          />
        </div>
      )}

      {outcome.kind === "not-a-skill" ? (
        <NotASkillPanel reason={outcome.reason} onStartTemplate={() => dispatch({ type: "reset" })} />
      ) : (
        <div className="grid flex-1 grid-cols-1 overflow-hidden md:grid-cols-[220px_1fr_360px]">
          <aside className="hidden border-r border-neutral-800 md:block">
            <FileTree
              files={state.files}
              activePath={state.activePath}
              onSelect={(p) => dispatch({ type: "selectFile", path: p })}
              onAdd={(p) => dispatch({ type: "addFile", path: p })}
              onDelete={(p) => dispatch({ type: "deleteFile", path: p })}
            />
          </aside>
          <main className="min-h-0 border-r border-neutral-800">
            <Editor file={activeFile} onChange={(c) => dispatch({ type: "editActive", content: c })} />
          </main>
          <aside className="flex min-h-0 flex-col">
            <div className="flex border-b border-neutral-800">
              <TabButton active={tab === "findings"} onClick={() => setTab("findings")}>
                Findings
                {outcome.findings.length > 0 && (
                  <span className="ml-1 rounded-full bg-neutral-700 px-1.5 text-xs">
                    {outcome.findings.length}
                  </span>
                )}
              </TabButton>
              <TabButton active={tab === "tokens"} onClick={() => setTab("tokens")}>
                Tokens
              </TabButton>
            </div>
            <div className="min-h-0 flex-1 overflow-auto">
              {tab === "findings" ? (
                <FindingsPanel
                  findings={outcome.findings}
                  onApplyFix={(f) => dispatch({ type: "applyFix", finding: f })}
                />
              ) : (
                <TokensPanel tokens={outcome.tokens} />
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
