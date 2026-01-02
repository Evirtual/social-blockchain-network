import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { createStableContext } from "@shared/lib/createStableContext";

export type Theme = "light" | "dark";

export type ThemeContextValue = {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (next: Theme) => void;
};

const ThemeContext = createStableContext("__sbnetThemeContext", () =>
  createContext<ThemeContextValue | null>(null)
);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ? "dark" : "light";
  });

  const toggleTheme = useCallback(() => {
    setThemeState((t) => (t === "dark" ? "light" : "dark"));
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      toggleTheme,
      setTheme: setThemeState
    }),
    [theme, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within <ThemeProvider>");
  return ctx;
}
