import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { Topbar } from "./Topbar";

describe("Topbar", () => {
  it("renders branding and Connect when disconnected", () => {
    render(
      <MemoryRouter>
        <Topbar
          theme="light"
          onToggleTheme={vi.fn()}
          walletAddress={null}
          onConnectWallet={vi.fn()}
          onOpenComposer={vi.fn()}
        />
      </MemoryRouter>
    );

    expect(screen.getByText("Social Blockchain Network")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Connect" })).toBeInTheDocument();
  });

  it("shows Create post button when connected", () => {
    render(
      <MemoryRouter>
        <Topbar
          theme="dark"
          onToggleTheme={vi.fn()}
          walletAddress="0x0000000000000000000000000000000000000001"
          onConnectWallet={vi.fn()}
          onOpenComposer={vi.fn()}
        />
      </MemoryRouter>
    );

    expect(screen.getByRole("button", { name: "Create post" })).toBeInTheDocument();
  });
});
