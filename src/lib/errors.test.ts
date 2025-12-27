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

  it("unwraps nested coalesce errors", () => {
    const msg = getErrorMessage({
      message: "could not coalesce error",
      info: { error: { message: "execution reverted: Poster not allowed" } }
    });
    expect(msg).toBe("Transaction reverted: Poster not allowed");
  });

  it("returns raw coalesce error when no nested message exists", () => {
    expect(getErrorMessage({ message: "could not coalesce error" })).toBe("could not coalesce error");
  });

  it("uses nested provider error message when top-level message is missing", () => {
    expect(
      getErrorMessage({
        info: { error: { data: { message: "inner rpc error" } } }
      })
    ).toBe("inner rpc error");
  });

  it("supports other deeply nested provider error shapes", () => {
    expect(
      getErrorMessage({
        info: { error: { data: { error: { message: "deep info error" } } } },
        error: { message: "wrapped error" },
        data: { message: "data message" },
        cause: { shortMessage: "cause short", reason: "cause reason", message: "cause message" }
      })
    ).toBe("deep info error");

    expect(getErrorMessage({ error: { message: "wrapped error" } })).toBe("wrapped error");
    expect(getErrorMessage({ error: { data: { message: "wrapped data error" } } })).toBe("wrapped data error");
    expect(getErrorMessage({ data: { message: "data message" } })).toBe("data message");
    expect(getErrorMessage({ cause: { shortMessage: "cause short" } })).toBe("cause short");
    expect(getErrorMessage({ cause: { reason: "cause reason" } })).toBe("cause reason");
    expect(getErrorMessage({ cause: { message: "cause message" } })).toBe("cause message");
  });

  it("handles execution reverted with no reason", () => {
    expect(getErrorMessage({ message: "execution reverted" })).toBe("Transaction reverted.");
  });

  it("maps RPC rate limit errors", () => {
    expect(getErrorMessage({ message: "429 Too Many Requests" })).toBe(
      "RPC rate limit reached. Try again in a moment, or switch RPC endpoint."
    );
    expect(getErrorMessage({ message: "rate limit exceeded" })).toBe(
      "RPC rate limit reached. Try again in a moment, or switch RPC endpoint."
    );
  });

  it("maps malformed JSON-RPC responses", () => {
    expect(getErrorMessage({ message: "Unterminated string in JSON at position 123" })).toBe(
      "RPC returned a malformed response. Try again, or switch RPC endpoint."
    );
    expect(getErrorMessage({ message: "Unexpected end of JSON input" })).toBe(
      "RPC returned a malformed response. Try again, or switch RPC endpoint."
    );
  });

  it("maps network/RPC fetch failures", () => {
    expect(getErrorMessage({ message: "Failed to fetch" })).toBe(
      "Network/RPC error. Check your RPC endpoint (or local node) and try again."
    );
    expect(getErrorMessage({ message: "Network error" })).toBe(
      "Network/RPC error. Check your RPC endpoint (or local node) and try again."
    );
    expect(getErrorMessage({ message: "timeout" })).toBe(
      "Network/RPC error. Check your RPC endpoint (or local node) and try again."
    );
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
