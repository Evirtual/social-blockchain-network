import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => cleanup());

// Basic browser API shims for jsdom tests.
if (typeof window !== "undefined") {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => {
      return {
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        // Legacy API fallbacks (some code uses them)
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false
      };
    }
  });

  if (!navigator.clipboard) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (navigator as any).clipboard = { writeText: async () => {} };
  }
}
