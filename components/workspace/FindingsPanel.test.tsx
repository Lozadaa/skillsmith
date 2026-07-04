// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { FindingsPanel } from "./FindingsPanel";
import type { Finding } from "@/lib/skill-lint";

afterEach(cleanup);

const findings: Finding[] = [
  { ruleId: "E02", severity: "error", message: "name is not kebab-case", why: "w", howToFix: "h" },
  {
    ruleId: "E12",
    severity: "error",
    message: "unquoted colon",
    why: "w",
    howToFix: "h",
    fix: { label: "Quote it", apply: (fs) => fs },
  },
  { ruleId: "W07", severity: "warning", message: "generic name", why: "w", howToFix: "h" },
];

describe("FindingsPanel", () => {
  it("renders grouped severities with counts and rule chips", () => {
    render(<FindingsPanel findings={findings} onApplyFix={() => {}} />);
    expect(screen.getByText("Errors")).toBeTruthy();
    expect(screen.getByText("Warnings")).toBeTruthy();
    expect(screen.getByText("E02")).toBeTruthy();
    expect(screen.getByText("W07")).toBeTruthy();
  });

  it("fires onApplyFix when the fix button is clicked", () => {
    const onApplyFix = vi.fn();
    render(<FindingsPanel findings={findings} onApplyFix={onApplyFix} />);
    fireEvent.click(screen.getByRole("button", { name: "Quote it" }));
    expect(onApplyFix).toHaveBeenCalledTimes(1);
    expect(onApplyFix.mock.calls[0][0].ruleId).toBe("E12");
  });

  it("shows the empty state with no findings", () => {
    render(<FindingsPanel findings={[]} onApplyFix={() => {}} />);
    expect(screen.getByText(/passes every enabled rule/i)).toBeTruthy();
  });
});
