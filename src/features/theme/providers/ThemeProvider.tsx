import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { createStableContext } from "@shared/lib/createStableContext";
import { requireContext } from "@shared/lib/reactContext";

export type Theme = "light" | "dark";

export type ThemeContextValue = {
  /** The theme actually in use, whether chosen or inherited from the system. */
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (next: Theme) => void;
};

const THEME_STORAGE_KEY = "socialBlockchainNetwork.theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";

const ThemeContext = createStableContext("__sbnetThemeContext", () =>
  createContext<ThemeContextValue | null>(null)
);

function readStoredTheme(): Theme | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : null;
  } catch {
    // Ignore storage errors (quota, disabled, etc.).
    return null;
  }
}

function readSystemTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia?.(DARK_QUERY)?.matches ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Absence of a stored value is itself the default: follow the system until
  // someone picks a side. Previously the derived value was written to storage
  // on first render, which froze the very first visit's system setting forever -
  // switching the OS to dark afterwards left the app on light.
  const [choice, setChoice] = useState<Theme | null>(readStoredTheme);
  const [systemTheme, setSystemTheme] = useState<Theme>(readSystemTheme);

  const theme = choice ?? systemTheme;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const query = window.matchMedia?.(DARK_QUERY);
    if (!query) return;

    const onChange = (event: MediaQueryListEvent) => setSystemTheme(event.matches ? "dark" : "light");
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  // Only an explicit choice is persisted, so following the system survives a
  // reload rather than being overwritten by the value it happened to resolve to.
  useEffect(() => {
    try {
      if (choice) window.localStorage.setItem(THEME_STORAGE_KEY, choice);
      else window.localStorage.removeItem(THEME_STORAGE_KEY);
    } catch {
      // Ignore storage errors (quota, disabled, etc.).
    }
  }, [choice]);

  const toggleTheme = useCallback(() => {
    setChoice((current) => ((current ?? readSystemTheme()) === "dark" ? "light" : "dark"));
  }, []);

  const setTheme = useCallback((next: Theme) => setChoice(next), []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      toggleTheme,
      setTheme
    }),
    [theme, toggleTheme, setTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  return requireContext(ctx, "useTheme", "ThemeProvider");
}
