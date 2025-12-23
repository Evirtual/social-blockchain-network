import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { TxNotificationsProvider, useTxNotifications } from "../contexts/TxNotificationsContext";
import { TxToaster } from "./TxToaster";

function Seed({ mode }: { mode: "none" | "pending" | "confirmed" | "failed" }) {
  const tx = useTxNotifications();

  useEffect(() => {
    if (mode === "none") return;

    const hash = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcd";

    if (mode === "pending") tx.notifyPending({ hash, label: "Mint post", explorerUrl: "https://explorer/tx" });
    if (mode === "confirmed") {
      tx.notifyPending({ hash, label: "Mint post", explorerUrl: "https://explorer/tx" });
      tx.notifyConfirmed(hash);
    }
    if (mode === "failed") tx.notifyFailed({ hash, label: "Mint post", error: "boom" });
  }, [mode]);

  return null;
}

describe("TxToaster", () => {
  it("renders nothing when empty", () => {
    render(
      <TxNotificationsProvider>
        <Seed mode="none" />
        <TxToaster />
      </TxNotificationsProvider>
    );

    expect(document.querySelector(".txToasts")).toBeNull();
  });

  it("renders pending toast with link", () => {
    render(
      <TxNotificationsProvider>
        <Seed mode="pending" />
        <TxToaster />
      </TxNotificationsProvider>
    );

    expect(screen.getByText("Mint post")).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", "https://explorer/tx");
  });

  it("dismisses a pending toast", async () => {
    render(
      <TxNotificationsProvider>
        <Seed mode="pending" />
        <TxToaster />
      </TxNotificationsProvider>
    );

    expect(screen.getByText("Mint post")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));

    await waitFor(() => {
      expect(screen.queryByText("Mint post")).toBeNull();
    });
  });

  it("renders failed toast error", () => {
    render(
      <TxNotificationsProvider>
        <Seed mode="failed" />
        <TxToaster />
      </TxNotificationsProvider>
    );

    expect(screen.getByText("boom")).toBeInTheDocument();
  });
});
