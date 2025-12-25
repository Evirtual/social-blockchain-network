import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Topbar } from "./Topbar";

describe("Topbar", () => {
  it("shows Connect when walletAddress is null", () => {
    render(
      <MemoryRouter>
        <Topbar
          theme="dark"
          onToggleTheme={() => {}}
          walletAddress={null}
          onConnectWallet={() => {}}
          onOpenComposer={() => {}}
        />
      </MemoryRouter>
    );

    expect(screen.getByText("Social Blockchain Network")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /connect/i })).toBeInTheDocument();
    expect(screen.queryByLabelText("Create post")).toBeNull();
  });

  it("highlights Connect when connectNudge is true", () => {
    render(
      <MemoryRouter>
        <Topbar
          theme="dark"
          onToggleTheme={() => {}}
          walletAddress={null}
          onConnectWallet={() => {}}
          onOpenComposer={() => {}}
          connectNudge
        />
      </MemoryRouter>
    );

    const btn = screen.getByRole("button", { name: /connect/i });
    expect(btn).toHaveClass("connectNudge");
  });

  it("renders rightSlot when walletAddress is present", () => {
    render(
      <MemoryRouter>
        <Topbar
          theme="light"
          onToggleTheme={() => {}}
          walletAddress="0x000000000000000000000000000000000000dEaD"
          onConnectWallet={() => {}}
          onOpenComposer={() => {}}
          rightSlot={<div>ACCOUNT</div>}
        />
      </MemoryRouter>
    );

    expect(screen.queryByRole("button", { name: /connect/i })).not.toBeInTheDocument();
    expect(screen.getByText("ACCOUNT")).toBeInTheDocument();

    const account = screen.getByText("ACCOUNT");
    const toggle = screen.getByLabelText("Toggle theme");
    expect(account.compareDocumentPosition(toggle) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("renders without rightSlot when walletAddress is present", () => {
    render(
      <MemoryRouter>
        <Topbar
          theme="light"
          onToggleTheme={() => {}}
          walletAddress="0x000000000000000000000000000000000000dEaD"
          onConnectWallet={() => {}}
          onOpenComposer={() => {}}
        />
      </MemoryRouter>
    );

    expect(screen.queryByRole("button", { name: /connect/i })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Create post")).toBeInTheDocument();
  });
});
