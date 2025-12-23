import React from "react";
import { describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import {
  TxNotificationsProvider,
  formatTxState,
  isUserRejectedTx,
  useTxNotifications
} from "./TxNotificationsContext";

function Consumer() {
  const ctx = useTxNotifications();
  const first = ctx.txNotices[0];
  return (
    <div>
      <div data-testid="count">{ctx.txNotices.length}</div>
      <div data-testid="first-hash">{first?.hash ?? ""}</div>
      <div data-testid="first-state">{first?.state ?? ""}</div>
      <button onClick={() => ctx.notifySigning("Mint")}>sign</button>
      <button
        onClick={() =>
          ctx.notifyPending({ hash: "0x1", label: "Mint", explorerUrl: "https://x" })
        }
      >
        pending
      </button>
      <button onClick={() => ctx.notifyConfirmed("0x1")}>confirm</button>
      <button onClick={() => ctx.notifyFailed({ hash: "0x2", label: "Tip", error: "no" })}>
        fail
      </button>
      <button onClick={() => ctx.notifyFailed({ label: "Tip", error: "oops" })}>failNoHash</button>
      <button onClick={() => ctx.notifyCancelled("Mint")}>cancel</button>
      <button onClick={() => ctx.dismiss("0x2")}>dismiss
      </button>
    </div>
  );
}

describe("TxNotificationsContext", () => {
  it("adds and patches notices", () => {
    render(
      <TxNotificationsProvider>
        <Consumer />
      </TxNotificationsProvider>
    );

    expect(screen.getByTestId("count")).toHaveTextContent("0");
    act(() => {
      screen.getByText("sign").click();
    });
    expect(screen.getByTestId("count")).toHaveTextContent("1");
    act(() => {
      screen.getByText("pending").click();
    });
    expect(screen.getByTestId("count")).toHaveTextContent("2");
    act(() => {
      screen.getByText("confirm").click();
    });
    expect(screen.getByTestId("count")).toHaveTextContent("2");
  });

  it("auto-dismisses failed/cancelled and supports manual dismiss", () => {
    vi.useFakeTimers();
    render(
      <TxNotificationsProvider>
        <Consumer />
      </TxNotificationsProvider>
    );

    act(() => {
      screen.getByText("fail").click();
    });
    expect(screen.getByTestId("count")).toHaveTextContent("1");
    act(() => {
      vi.advanceTimersByTime(4900);
    });
    expect(screen.getByTestId("count")).toHaveTextContent("1");
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.getByTestId("count")).toHaveTextContent("0");

    act(() => {
      screen.getByText("fail").click();
    });
    expect(screen.getByTestId("count")).toHaveTextContent("1");
    act(() => {
      screen.getByText("dismiss").click();
    });
    expect(screen.getByTestId("count")).toHaveTextContent("0");

    vi.useRealTimers();
  });

  it("clears any existing dismiss timer on dismiss() and notifyPending()", () => {
    const setTimeoutSpy = vi.spyOn(window, "setTimeout").mockReturnValue(123 as any);
    const clearTimeoutSpy = vi.spyOn(window, "clearTimeout");

    render(
      <TxNotificationsProvider>
        <Consumer />
      </TxNotificationsProvider>
    );

    // notifyFailed schedules auto-dismiss for 0x2, dismiss should clear it.
    act(() => {
      screen.getByText("fail").click();
    });
    expect(screen.getByTestId("count")).toHaveTextContent("1");
    act(() => {
      screen.getByText("dismiss").click();
    });
    expect(clearTimeoutSpy).toHaveBeenCalledWith(123);
    expect(screen.getByTestId("count")).toHaveTextContent("0");

    // notifyConfirmed schedules auto-dismiss for 0x1; notifyPending should clear it.
    act(() => {
      screen.getByText("pending").click();
      screen.getByText("confirm").click();
    });
    act(() => {
      screen.getByText("pending").click();
    });
    expect(clearTimeoutSpy).toHaveBeenCalledWith(123);

    setTimeoutSpy.mockRestore();
    clearTimeoutSpy.mockRestore();
  });

  it("supports cancelled notices and failed notices without a hash", () => {
    vi.spyOn(window, "setTimeout").mockReturnValue(123 as any);

    render(
      <TxNotificationsProvider>
        <Consumer />
      </TxNotificationsProvider>
    );

    act(() => {
      screen.getByText("cancel").click();
    });
    expect(screen.getByTestId("first-state")).toHaveTextContent("cancelled");
    expect(screen.getByTestId("first-hash").textContent).toContain("cancelled-");

    act(() => {
      screen.getByText("failNoHash").click();
    });
    expect(screen.getByTestId("first-state")).toHaveTextContent("failed");
    expect(screen.getByTestId("first-hash").textContent).toContain("failed-");
  });

  it("does not schedule auto-dismiss twice for the same hash", () => {
    const setTimeoutSpy = vi.spyOn(window, "setTimeout").mockReturnValue(123 as any);

    render(
      <TxNotificationsProvider>
        <Consumer />
      </TxNotificationsProvider>
    );

    act(() => {
      screen.getByText("pending").click();
      screen.getByText("confirm").click();
      screen.getByText("confirm").click();
    });

    expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
    setTimeoutSpy.mockRestore();
  });

  it("throws when used outside provider", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    function Bad() {
      useTxNotifications();
      return null;
    }

    try {
      expect(() => render(<Bad />)).toThrow(/useTxNotifications must be used/);
    } finally {
      consoleError.mockRestore();
    }
  });

  it("helpers classify and format tx states", () => {
    expect(isUserRejectedTx({ code: 4001 })).toBe(true);
    expect(isUserRejectedTx({ code: "ACTION_REJECTED" })).toBe(true);
    expect(isUserRejectedTx({ code: "OTHER" })).toBe(false);

    expect(formatTxState("signing")).toMatch(/confirm/);
    expect(formatTxState("pending")).toMatch(/progress/);
    expect(formatTxState("confirmed")).toBe("confirmed");
    expect(formatTxState("cancelled")).toBe("cancelled");
    expect(formatTxState("failed")).toBe("failed");
  });
});
