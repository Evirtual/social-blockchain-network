import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider, useTheme } from "./ThemeProvider";

const STORAGE_KEY = "socialBlockchainNetwork.theme";

/** Lets a test flip the OS preference and fire the change the browser would. */
function stubSystemTheme(initial: "light" | "dark") {
  let matches = initial === "dark";
  const listeners = new Set<(event: MediaQueryListEvent) => void>();

  window.matchMedia = vi.fn().mockImplementation(() => ({
    get matches() {
      return matches;
    },
    addEventListener: (_: string, fn: (event: MediaQueryListEvent) => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: (event: MediaQueryListEvent) => void) => listeners.delete(fn)
  })) as unknown as typeof window.matchMedia;

  return {
    set(next: "light" | "dark") {
      matches = next === "dark";
      act(() => {
        for (const fn of listeners) fn({ matches } as MediaQueryListEvent);
      });
    }
  };
}

function Probe() {
  const { theme, toggleTheme } = useTheme();
  return (
    <>
      <span data-testid="theme">{theme}</span>
      <button onClick={toggleTheme}>toggle</button>
    </>
  );
}

const renderProbe = () =>
  render(
    <ThemeProvider>
      <Probe />
    </ThemeProvider>
  );

describe("ThemeProvider", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("follows the system when nothing has been chosen", () => {
    stubSystemTheme("dark");
    renderProbe();

    expect(screen.getByTestId("theme")).toHaveTextContent("dark");
  });

  it("does not persist the system's value, so it keeps following after a reload", () => {
    // The previous implementation wrote the resolved theme on mount, which froze
    // the first visit's system setting and stopped tracking it thereafter.
    stubSystemTheme("light");
    renderProbe();

    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("tracks the system changing while no choice has been made", () => {
    const system = stubSystemTheme("light");
    renderProbe();
    expect(screen.getByTestId("theme")).toHaveTextContent("light");

    system.set("dark");
    expect(screen.getByTestId("theme")).toHaveTextContent("dark");
  });

  describe("once someone picks a side", () => {
    it("keeps that choice and stops following", async () => {
      const system = stubSystemTheme("light");
      renderProbe();

      await userEvent.click(screen.getByRole("button", { name: "toggle" }));
      expect(screen.getByTestId("theme")).toHaveTextContent("dark");

      system.set("light");
      expect(screen.getByTestId("theme")).toHaveTextContent("dark");
    });

    it("persists it", async () => {
      stubSystemTheme("light");
      renderProbe();

      await userEvent.click(screen.getByRole("button", { name: "toggle" }));
      expect(window.localStorage.getItem(STORAGE_KEY)).toBe("dark");
    });

  });

  it("respects a stored choice over the system", () => {
    window.localStorage.setItem(STORAGE_KEY, "light");
    stubSystemTheme("dark");
    renderProbe();

    expect(screen.getByTestId("theme")).toHaveTextContent("light");
  });
});
