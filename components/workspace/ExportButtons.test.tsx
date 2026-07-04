// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ExportButtons } from "./ExportButtons";
import type { SkillFile } from "@/lib/skill-lint";

afterEach(cleanup);

const files: SkillFile[] = [{ path: "SKILL.md", content: "---\nname: demo\n---\nbody" }];

describe("ExportButtons export gate", () => {
  it("disables package downloads when an error exists; copy stays enabled", () => {
    render(<ExportButtons files={files} dirName="demo" hasError={true} />);
    expect((screen.getByRole("button", { name: "Download .zip" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Download .skill" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Copy SKILL.md" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("enables package downloads with no errors", () => {
    render(<ExportButtons files={files} dirName="demo" hasError={false} />);
    expect((screen.getByRole("button", { name: "Download .zip" }) as HTMLButtonElement).disabled).toBe(false);
  });
});
