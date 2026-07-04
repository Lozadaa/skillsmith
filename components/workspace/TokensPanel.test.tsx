// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { TokensPanel } from "./TokensPanel";
import type { TokenReport } from "@/lib/skill-lint";

afterEach(cleanup);

const tokens: TokenReport = { metadata: 30, body: 120, references: 80, scriptFiles: 2, total: 230 };

describe("TokensPanel", () => {
  it("renders the four progressive-disclosure rows and the total", () => {
    render(<TokensPanel tokens={tokens} />);
    expect(screen.getByText(/Metadata \(name \+ description\)/)).toBeTruthy();
    expect(screen.getByText("SKILL.md body")).toBeTruthy();
    expect(screen.getByText("references/ files")).toBeTruthy();
    expect(screen.getByText("scripts/ files")).toBeTruthy();
    expect(screen.getByText("230 tok")).toBeTruthy();
  });

  it("labels the estimate as approximate", () => {
    render(<TokensPanel tokens={tokens} />);
    expect(screen.getByText(/~estimated/)).toBeTruthy();
  });
});
