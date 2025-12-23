import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider, useTheme } from "./ThemeContext";

function Consumer() {
  const { theme, toggleTheme, setTheme } = useTheme();
  return (
    <div>
      <div data-testid="theme">{theme}</div>
      <button onClick={() => toggleTheme()}>toggle</button>
      <button onClick={() => setTheme("dark")}>dark</button>
    </div>
  );
}

describe("ThemeContext", () => {
  it("initializes from localStorage and writes to document", () => {
    localStorage.setItem("socialBlockchainNetwork.theme", "dark");
    render(
      <ThemeProvider>
        <Consumer />
      </ThemeProvider>
    );

    expect(screen.getByTestId("theme")).toHaveTextContent("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("initializes from the legacy storage key when primary key missing", () => {
    localStorage.removeItem("socialBlockchainNetwork.theme");
    localStorage.setItem("mintedSocial.theme", "dark");

    render(
      <ThemeProvider>
        <Consumer />
      </ThemeProvider>
    );

    expect(screen.getByTestId("theme")).toHaveTextContent("dark");
  });

  it("falls back to prefers-color-scheme when no stored theme", () => {
    localStorage.removeItem("socialBlockchainNetwork.theme");
    localStorage.removeItem("mintedSocial.theme");

    const originalMatchMedia = window.matchMedia;
    Object.defineProperty(window, "matchMedia", {
      value: vi.fn().mockReturnValue({ matches: true }),
      configurable: true
    });

    render(
      <ThemeProvider>
        <Consumer />
      </ThemeProvider>
    );

    expect(screen.getByTestId("theme")).toHaveTextContent("dark");

    Object.defineProperty(window, "matchMedia", {
      value: originalMatchMedia,
      configurable: true
    });
  });

  it("defaults to light when matchMedia is unavailable", () => {
    localStorage.removeItem("socialBlockchainNetwork.theme");
    localStorage.removeItem("mintedSocial.theme");

    const originalMatchMedia = window.matchMedia;
    Object.defineProperty(window, "matchMedia", {
      value: undefined,
      configurable: true
    });

    render(
      <ThemeProvider>
        <Consumer />
      </ThemeProvider>
    );

    expect(screen.getByTestId("theme")).toHaveTextContent("light");

    Object.defineProperty(window, "matchMedia", {
      value: originalMatchMedia,
      configurable: true
    });
  });

  it("toggleTheme and setTheme update state", () => {
    localStorage.setItem("socialBlockchainNetwork.theme", "dark");
    render(
      <ThemeProvider>
        <Consumer />
      </ThemeProvider>
    );

    fireEvent.click(screen.getByText("toggle"));
    expect(screen.getByTestId("theme")).toHaveTextContent("light");
    fireEvent.click(screen.getByText("toggle"));
    expect(screen.getByTestId("theme")).toHaveTextContent("dark");
    fireEvent.click(screen.getByRole("button", { name: "dark" }));
    expect(screen.getByTestId("theme")).toHaveTextContent("dark");
    expect(localStorage.getItem("socialBlockchainNetwork.theme")).toBe("dark");
  });

  it("falls back to light theme when localStorage access throws", () => {
    const getItemSpy = vi.spyOn(window.Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("no storage");
    });

    render(
      <ThemeProvider>
        <Consumer />
      </ThemeProvider>
    );

    expect(screen.getByTestId("theme")).toHaveTextContent("light");

    getItemSpy.mockRestore();
  });

  it("ignores errors while persisting theme", () => {
    const setItemSpy = vi.spyOn(window.Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("write failed");
    });

    render(
      <ThemeProvider>
        <Consumer />
      </ThemeProvider>
    );

    expect(screen.getByTestId("theme")).toBeInTheDocument();

    setItemSpy.mockRestore();
  });

  it("throws when used outside provider", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(() => render(<Consumer />)).toThrow(/useTheme must be used/);
    } finally {
      consoleError.mockRestore();
    }
  });
});
