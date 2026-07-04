// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import WorkspacePage from "./page";

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(cleanup);

describe("WorkspacePage paste flow", () => {
  it("shows an E02 finding after pasting a skill with a bad name", () => {
    render(<WorkspacePage />);
    // Open the analyze panel.
    fireEvent.click(screen.getByRole("button", { name: "Open…" }));
    const paste = screen.getByLabelText("Paste a SKILL.md");
    fireEvent.change(paste, {
      target: {
        value:
          "---\nname: Bad_Name\ndescription: Use when exercising the workspace paste flow end to end for tests\n---\n# Body",
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Analyze" }));
    // The engine flags the non-kebab name as E02 and the panel renders its chip.
    expect(screen.getByText("E02")).toBeTruthy();
  });

  it("renders the demo skill with an excellent score on first mount", () => {
    render(<WorkspacePage />);
    // Demo is valid → no error findings → export enabled.
    expect((screen.getByRole("button", { name: "Download .zip" }) as HTMLButtonElement).disabled).toBe(false);
  });
});
