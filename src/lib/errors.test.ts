import { describe, expect, it } from "vitest";
import { getErrorMessage } from "./errors";

describe("getErrorMessage", () => {
  it("maps user rejection", () => {
    expect(getErrorMessage({ code: 4001 })).toBe("Transaction rejected in wallet.");
    expect(getErrorMessage({ code: "ACTION_REJECTED" })).toBe("Transaction rejected in wallet.");
  });

  it("handles missing revert data", () => {
    const msg = getErrorMessage({ message: "missing revert data" });
    expect(msg.toLowerCase()).toContain("transaction reverted");
  });

  it("handles insufficient funds", () => {
    expect(getErrorMessage({ message: "insufficient funds" })).toBe("Insufficient funds for gas.");
  });

  it("handles local port already in use", () => {
    expect(getErrorMessage({ message: "EADDRINUSE: address already in use" })).toBe("Local RPC port is already in use.");
  });

  it("prefers shortMessage then reason then message", () => {
    expect(getErrorMessage({ shortMessage: "SHORT", reason: "REASON", message: "MSG" })).toBe("SHORT");
    expect(getErrorMessage({ reason: "REASON", message: "MSG" })).toBe("REASON");
    expect(getErrorMessage({ message: "MSG" })).toBe("MSG");
  });

  it("falls back to default", () => {
    expect(getErrorMessage(null)).toBe("Transaction failed.");
  });
});
