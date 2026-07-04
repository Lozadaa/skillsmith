// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import CollectionAudit from "./CollectionAudit";
import type { PickerSkill } from "@/lib/github/importFlow";

function s(name: string, score: number, errors: number): PickerSkill {
  return { ref: { dirPath: `skills/${name}`, name, origin: "skills-dir", viaSymlink: false }, lint: { ok: true, score, errors, warnings: 0 }, scanned: true };
}

describe("CollectionAudit", () => {
  const skills = [s("a", 40, 3), s("b", 95, 0), s("c", 70, 1)];

  it("reveals a sortable table behind the audit button and sorts by score", () => {
    render(<CollectionAudit skills={skills} />);
    fireEvent.click(screen.getByRole("button", { name: /audit whole collection/i }));

    // Default sort: worst score first.
    const rows = screen.getAllByRole("row").slice(1); // drop header
    expect(within(rows[0]).getByText("a")).toBeTruthy();
    expect(within(rows[2]).getByText("b")).toBeTruthy();

    // Toggling the Score header flips the order (best first).
    fireEvent.click(screen.getByRole("button", { name: /^score$/i }));
    const flipped = screen.getAllByRole("row").slice(1);
    expect(within(flipped[0]).getByText("b")).toBeTruthy();
  });
});
