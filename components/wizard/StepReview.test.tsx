// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

afterEach(cleanup);

const { push, stash, zip, download } = vi.hoisted(() => ({
  push: vi.fn(),
  stash: vi.fn(),
  zip: vi.fn(),
  download: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/lib/handoff", () => ({ stashIncomingSkill: stash }));
vi.mock("@/lib/zip", () => ({
  zipSkill: zip.mockReturnValue(new Uint8Array([1])),
  downloadBlob: download,
}));

import { StepReview } from "./StepReview";
import { initialWizardState, seedSections, type WizardState } from "@/lib/wizard/state";

function validState(): WizardState {
  return {
    ...initialWizardState,
    step: 5,
    archetypeId: "technique",
    name: "demo-skill",
    descWhat: "Produces a demo artifact",
    descWhen: "the user asks for a demo",
    descTriggers: '"make a demo"',
    sections: seedSections("technique"),
  };
}

describe("StepReview export gate", () => {
  beforeEach(() => {
    push.mockClear();
    stash.mockClear();
    download.mockClear();
  });

  it("enables download for a clean skill and stashes + routes on Open in Workspace", () => {
    render(<StepReview state={validState()} />);
    const dl = screen.getByTestId("download-zip") as HTMLButtonElement;
    expect(dl.disabled).toBe(false);

    fireEvent.click(screen.getByText("Open in Workspace"));
    expect(stash).toHaveBeenCalledTimes(1);
    const [files, opts] = stash.mock.calls[0];
    expect(files[0].path).toBe("SKILL.md");
    expect(opts).toMatchObject({ dirName: "demo-skill", source: "wizard" });
    expect(push).toHaveBeenCalledWith("/workspace");
  });

  it("disables download when the skill has an error finding (empty name -> E02)", () => {
    render(<StepReview state={{ ...validState(), name: "" }} />);
    const dl = screen.getByTestId("download-zip") as HTMLButtonElement;
    expect(dl.disabled).toBe(true);
  });
});
