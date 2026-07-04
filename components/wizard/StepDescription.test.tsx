// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { StepDescription } from "./StepDescription";
import { initialWizardState, type WizardState } from "@/lib/wizard/state";

function stateWith(overrides: Partial<WizardState>): WizardState {
  return { ...initialWizardState, ...overrides };
}

describe("StepDescription", () => {
  it("renders the assembled description preview", () => {
    render(
      <StepDescription
        state={stateWith({
          name: "make-demo",
          descWhat: "Produces a demo artifact",
          descWhen: "the user asks for a demo",
          descTriggers: '"make a demo"',
        })}
        dispatch={vi.fn()}
      />
    );
    expect(screen.getByTestId("desc-preview").textContent).toContain(
      'Produces a demo artifact. Use when the user asks for a demo. Triggers: "make a demo".'
    );
  });

  it("shows no long-description warning under 500 chars", () => {
    render(
      <StepDescription
        state={stateWith({ descWhat: "short", descWhen: "x", descTriggers: "y" })}
        dispatch={vi.fn()}
      />
    );
    expect(screen.queryByTestId("desc-warn")).toBeNull();
  });

  it("warns once the description passes 500 chars", () => {
    render(
      <StepDescription
        state={stateWith({ descWhat: "a".repeat(600), descWhen: "x", descTriggers: "y" })}
        dispatch={vi.fn()}
      />
    );
    expect(screen.getByTestId("desc-warn")).toBeTruthy();
  });

  it("flags third-person / second-person phrasing", () => {
    render(
      <StepDescription
        state={stateWith({ descWhat: "you can do things", descWhen: "x", descTriggers: "y" })}
        dispatch={vi.fn()}
      />
    );
    expect(screen.getByTestId("desc-person-hint")).toBeTruthy();
  });
});
