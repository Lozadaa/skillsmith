// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import { LocaleProvider, useLocale } from "./LocaleProvider";
import { SiteHeader } from "./SiteHeader";
import { LOCALE_STORAGE_KEY } from "@/lib/i18n";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

function Consumer() {
  const { locale, t } = useLocale();
  return (
    <div>
      <span data-testid="locale">{locale}</span>
      <span data-testid="text">{t("workspace.open")}</span>
    </div>
  );
}

describe("LocaleProvider", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(window.navigator, "language", "get").mockReturnValue("en-US");
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders English by default and switches text when setLocale('es') fires", async () => {
    function Wrapper() {
      const { setLocale } = useLocale();
      return (
        <div>
          <Consumer />
          <button type="button" onClick={() => setLocale("es")}>
            switch
          </button>
        </div>
      );
    }
    render(
      <LocaleProvider>
        <Wrapper />
      </LocaleProvider>
    );

    expect(screen.getByTestId("text").textContent).toBe("Open…");

    await act(async () => {
      fireEvent.click(screen.getByText("switch"));
    });

    expect(screen.getByTestId("locale").textContent).toBe("es");
    expect(screen.getByTestId("text").textContent).toBe("Abrir…");
  });
});

describe("SiteHeader locale toggle", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(window.navigator, "language", "get").mockReturnValue("en-US");
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("shows the other locale as the toggle action and persists the switch to localStorage", async () => {
    render(
      <LocaleProvider>
        <SiteHeader />
      </LocaleProvider>
    );

    const toggle = await screen.findByRole("button", { name: /switch language/i });
    expect(toggle.textContent).toBe("ES");

    await act(async () => {
      fireEvent.click(toggle);
    });

    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe("es");
    expect(screen.getByRole("button", { name: /cambiar idioma/i }).textContent).toBe("EN");
  });
});
