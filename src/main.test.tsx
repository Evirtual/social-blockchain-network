import React from "react";
import { describe, expect, it, vi } from "vitest";

const domMocks = vi.hoisted(() => {
  const render = vi.fn();
  const createRoot = vi.fn(() => ({ render }));
  return { render, createRoot };
});

vi.mock("react-dom/client", () => ({
  default: {
    createRoot: domMocks.createRoot
  }
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    BrowserRouter: ({ children }: { children: React.ReactNode }) => <>{children}</>
  };
});

vi.mock("./App", () => ({
  default: () => <div data-testid="boot-app" />
}));

describe("main bootstrap", () => {
  it("creates a root and renders the app", async () => {
    vi.resetModules();

    document.body.innerHTML = '<div id="root"></div>';

    await import("./main");

    expect(domMocks.createRoot).toHaveBeenCalledTimes(1);
    expect(domMocks.render).toHaveBeenCalledTimes(1);
  });
});
