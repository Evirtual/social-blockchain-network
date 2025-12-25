import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(async () => {
  // Prevent fake-timer leakage between tests.
  // IMPORTANT: restore real timers BEFORE `cleanup()`.
  // React Testing Library's cleanup/unmount is wrapped in React `act()` and can
  // internally depend on timers; if fake timers are enabled, cleanup can stall.
  if ((vi as any).isFakeTimers?.() === true) {
    try {
      // Best-effort: drain pending timers so nothing is left queued.
      if (typeof (vi as any).runOnlyPendingTimersAsync === "function") {
        await (vi as any).runOnlyPendingTimersAsync();
      } else if (typeof (vi as any).runOnlyPendingTimers === "function") {
        (vi as any).runOnlyPendingTimers();
      }
    } catch {
      // ignore
    }

    try {
      // Best-effort: clear anything remaining under fake timers.
      if (typeof (vi as any).clearAllTimers === "function") {
        (vi as any).clearAllTimers();
      }
    } catch {
      // ignore
    }
    vi.useRealTimers();
  }

  cleanup();

  // Best-effort: allow any queued microtasks to settle.
  await Promise.resolve();
});

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
