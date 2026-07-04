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

  it("disables Download .zip when the pasted content is not a skill", () => {
    render(<WorkspacePage />);
    fireEvent.click(screen.getByRole("button", { name: "Open…" }));
    const paste = screen.getByLabelText("Paste a SKILL.md");
    fireEvent.change(paste, { target: { value: "# just markdown" } });
    fireEvent.click(screen.getByRole("button", { name: "Analyze" }));
    // No frontmatter → not-a-skill → export must stay gated even though there are no "skill" findings.
    expect((screen.getByRole("button", { name: "Download .zip" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("gates Publish to GitHub behind the same error gate as export", () => {
    render(<WorkspacePage />);
    // Demo is valid → publish enabled.
    expect((screen.getByRole("button", { name: "Publish to GitHub" }) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Open…" }));
    const paste = screen.getByLabelText("Paste a SKILL.md");
    fireEvent.change(paste, { target: { value: "# just markdown" } });
    fireEvent.click(screen.getByRole("button", { name: "Analyze" }));
    // Not-a-skill → publish disabled.
    expect((screen.getByRole("button", { name: "Publish to GitHub" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("refreshes the publish dialog's repo name prefill after loading a different skill", async () => {
    render(<WorkspacePage />);

    // Open publish with the initial demo skill loaded (dirName "my-first-skill").
    fireEvent.click(screen.getByRole("button", { name: "Publish to GitHub" }));
    expect((screen.getByLabelText(/repository name/i) as HTMLInputElement).value).toBe("my-first-skill");
    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    // Load a different skill via folder upload so dirName changes.
    fireEvent.click(screen.getByRole("button", { name: "Open…" }));
    const dirInput = screen.getByLabelText("Upload folder") as HTMLInputElement;
    const file = new File(
      [
        "---\nname: other-skill\ndescription: Use when testing a fresh mount reopen for the publish dialog\n---\n# Body",
      ],
      "SKILL.md",
      { type: "text/markdown" }
    );
    Object.defineProperty(file, "webkitRelativePath", { value: "other-skill/SKILL.md" });
    fireEvent.change(dirInput, { target: { files: [file] } });

    // Reopen publish — repo name must reflect the NEW dirName, not the stale one.
    fireEvent.click(await screen.findByRole("button", { name: "Publish to GitHub" }));
    expect((screen.getByLabelText(/repository name/i) as HTMLInputElement).value).toBe("other-skill");
  });
});
