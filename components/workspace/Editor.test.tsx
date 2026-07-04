// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { Editor } from "./Editor";
import type { SkillFile } from "@/lib/skill-lint";

afterEach(cleanup);

function makeFile(content: string): SkillFile {
  return { path: "SKILL.md", content };
}

describe("Editor overlay highlighting", () => {
  it("renders nothing but the empty state when no file is selected", () => {
    render(<Editor file={undefined} onChange={() => {}} />);
    expect(screen.getByText("No file selected.")).toBeTruthy();
  });

  it("renders an aria-hidden overlay <pre> behind the textarea", () => {
    const { container } = render(<Editor file={makeFile("# Title\n")} onChange={() => {}} />);
    const pre = container.querySelector("pre[aria-hidden]");
    expect(pre).toBeTruthy();
  });

  it("renders a heading span with the ink-soft/bold heading treatment for a # Title line", () => {
    const { container } = render(<Editor file={makeFile("# Title\n")} onChange={() => {}} />);
    const pre = container.querySelector("pre[aria-hidden]");
    const headingSpan = pre!.querySelector("span.font-bold");
    expect(headingSpan).toBeTruthy();
    expect(headingSpan!.textContent).toContain("# Title");
  });

  it("still fires onChange with the new content when the textarea is edited", () => {
    const onChange = vi.fn();
    render(<Editor file={makeFile("hello")} onChange={onChange} />);
    const textarea = screen.getByLabelText("Editor for SKILL.md") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "hello world" } });
    expect(onChange).toHaveBeenCalledWith("hello world");
  });

  it("keeps the textarea value in sync with file.content", () => {
    render(<Editor file={makeFile("hello")} onChange={() => {}} />);
    const textarea = screen.getByLabelText("Editor for SKILL.md") as HTMLTextAreaElement;
    expect(textarea.value).toBe("hello");
  });

  it("resyncs the overlay scroll position when switching to a different file", () => {
    const { container, rerender } = render(
      <Editor file={makeFile("line\n".repeat(200))} onChange={() => {}} />,
    );
    const textarea = screen.getByLabelText("Editor for SKILL.md") as HTMLTextAreaElement;
    const pre = container.querySelector("pre[aria-hidden]") as HTMLPreElement;

    // Simulate the first file having been scrolled down, leaving the overlay
    // desynced (jsdom doesn't lay out scrollHeight, so set both directly).
    Object.defineProperty(textarea, "scrollTop", { value: 500, configurable: true });
    Object.defineProperty(pre, "scrollTop", { value: 0, writable: true, configurable: true });

    rerender(
      <Editor
        file={{ path: "OTHER.md", content: "different content" }}
        onChange={() => {}}
      />,
    );

    expect(pre.scrollTop).toBe(textarea.scrollTop);
  });
});
