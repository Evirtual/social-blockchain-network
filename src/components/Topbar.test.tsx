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
