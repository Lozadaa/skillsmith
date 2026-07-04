// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { StepContent } from "./StepContent";
import { initialWizardState, seedSections, type WizardState } from "@/lib/wizard/state";

function state(archetypeId: string, overrides: Partial<WizardState> = {}): WizardState {
  return { ...initialWizardState, archetypeId, sections: seedSections(archetypeId), name: "demo", ...overrides };
}

describe("StepContent", () => {
  it("renders one textarea per archetype section and a live meter", () => {
    render(<StepContent state={state("technique")} dispatch={vi.fn()} />);
    expect(screen.getByTestId("body-lines").textContent).toMatch(/\d+ lines/);
    expect(screen.queryByTestId("body-warn")).toBeNull();
  });

  it("warns when the assembled body exceeds 400 lines", () => {
    const big = state("technique");
    big.sections = { ...big.sections, overview: "line\n".repeat(500) };
    render(<StepContent state={big} dispatch={vi.fn()} />);
    expect(screen.getByTestId("body-warn")).toBeTruthy();
  });
});
