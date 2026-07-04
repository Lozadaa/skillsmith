// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { FileTree } from "./FileTree";
import type { SkillFile } from "@/lib/skill-lint";

afterEach(cleanup);

const files: SkillFile[] = [
  { path: "SKILL.md", content: "a" },
  { path: "references/api.md", content: "b" },
];

describe("FileTree", () => {
  it("selects a file on click", () => {
    const onSelect = vi.fn();
    render(<FileTree files={files} activePath="SKILL.md" onSelect={onSelect} onAdd={() => {}} onDelete={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "references/api.md" }));
    expect(onSelect).toHaveBeenCalledWith("references/api.md");
  });

  it("adds a file via the input form", () => {
    const onAdd = vi.fn();
    render(<FileTree files={files} activePath="SKILL.md" onSelect={() => {}} onAdd={onAdd} onDelete={() => {}} />);
    const input = screen.getByLabelText("New file path");
    fireEvent.change(input, { target: { value: "scripts/run.py" } });
    fireEvent.submit(input);
    expect(onAdd).toHaveBeenCalledWith("scripts/run.py");
  });

  it("deletes a non-entry file and never offers to delete SKILL.md", () => {
    const onDelete = vi.fn();
    render(<FileTree files={files} activePath="SKILL.md" onSelect={() => {}} onAdd={() => {}} onDelete={onDelete} />);
    expect(screen.queryByLabelText("Delete SKILL.md")).toBeNull();
    fireEvent.click(screen.getByLabelText("Delete references/api.md"));
    expect(onDelete).toHaveBeenCalledWith("references/api.md");
  });

  it("reveals the delete button on keyboard focus, not just hover", () => {
    render(<FileTree files={files} activePath="SKILL.md" onSelect={() => {}} onAdd={() => {}} onDelete={() => {}} />);
    const del = screen.getByLabelText("Delete references/api.md");
    expect(del.className).toContain("focus:opacity-100");
  });
});
