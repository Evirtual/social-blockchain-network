import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("./AppShell", () => ({
  AppShell: () => <div data-testid="app-shell" />
}));

vi.mock("./contexts/AppContext", () => ({
  AppProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="app-provider">{children}</div>
  )
}));
vi.mock("./contexts/ContractContext", () => ({
  ContractProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="contract-provider">{children}</div>
  )
}));
vi.mock("./contexts/StatusContext", () => ({
  StatusProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="status-provider">{children}</div>
  )
}));
vi.mock("./contexts/ThemeContext", () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="theme-provider">{children}</div>
  )
}));
vi.mock("./contexts/TxNotificationsContext", () => ({
  TxNotificationsProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="tx-provider">{children}</div>
  )
}));
vi.mock("./contexts/WalletContext", () => ({
  WalletProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="wallet-provider">{children}</div>
  )
}));

import App from "./App";

describe("App", () => {
  it("renders the provider stack and AppShell", () => {
    render(<App />);
    expect(screen.getByTestId("app-shell")).toBeInTheDocument();
    expect(screen.getByTestId("tx-provider")).toBeInTheDocument();
    expect(screen.getByTestId("status-provider")).toBeInTheDocument();
    expect(screen.getByTestId("theme-provider")).toBeInTheDocument();
    expect(screen.getByTestId("wallet-provider")).toBeInTheDocument();
    expect(screen.getByTestId("contract-provider")).toBeInTheDocument();
    expect(screen.getByTestId("app-provider")).toBeInTheDocument();
  });
});
