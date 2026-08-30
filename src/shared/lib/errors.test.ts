import { describe, expect, it, vi } from "vitest";
import { getErrorMessage, setStatusFromError } from "./errors";

describe("getErrorMessage", () => {
  describe("user rejection", () => {
    it("recognises the EIP-1193 numeric code", () => {
      expect(getErrorMessage({ code: 4001, message: "User denied" } as never)).toBe(
        "Transaction rejected in wallet."
      );
    });

    it("recognises the ethers ACTION_REJECTED code", () => {
      expect(getErrorMessage({ code: "ACTION_REJECTED" } as never)).toBe("Transaction rejected in wallet.");
    });
  });

  describe("insufficient balance", () => {
    // Regression: an underfunded tip fails gas estimation and arrives as a
    // CALL_EXCEPTION with no revert data. This used to be reported as an
    // oversized-image problem, which is unrelated to tipping entirely.
    it("does not blame image size when a tip is underfunded", () => {
      const underfundedTip = {
        code: "CALL_EXCEPTION",
        shortMessage: "missing revert data",
        message: "missing revert data (action=\"estimateGas\")"
      };

      const message = getErrorMessage(underfundedTip as never);

      expect(message).not.toMatch(/image/i);
      expect(message).not.toMatch(/metadata/i);
      expect(message).not.toMatch(/IPFS/i);
    });

    it("reports a balance shortfall from the geth error text", () => {
      const err = {
        message: "insufficient funds for gas * price + value: balance 100, tx cost 200"
      };
      expect(getErrorMessage(err as never)).toBe(
        "Not enough balance to cover this transaction (amount plus gas fees)."
      );
    });

    it("reports a balance shortfall from the ethers error code alone", () => {
      expect(getErrorMessage({ code: "INSUFFICIENT_FUNDS" } as never)).toBe(
        "Not enough balance to cover this transaction (amount plus gas fees)."
      );
    });

    it.each([
      "insufficient balance for transfer",
      "value exceeds balance",
      "sender doesn't have enough funds to send tx"
    ])("recognises the provider phrasing %j", (text) => {
      expect(getErrorMessage({ message: text } as never)).toBe(
        "Not enough balance to cover this transaction (amount plus gas fees)."
      );
    });

    it("prefers the balance message over the generic revert branch", () => {
      // Both phrases present: the balance shortfall is the actionable one.
      const err = { message: "missing revert data: insufficient funds for transfer" };
      expect(getErrorMessage(err as never)).toBe(
        "Not enough balance to cover this transaction (amount plus gas fees)."
      );
    });
  });

  describe("rate limiting", () => {
    it.each(["Subgraph HTTP 429: Rate limited", "Too Many Requests", "rate limit exceeded"])(
      "maps %j to the rate-limit message",
      (text) => {
        expect(getErrorMessage({ message: text } as never)).toMatch(/rate limit/i);
      }
    );
  });

  describe("revert reasons", () => {
    it("extracts the reason string after 'execution reverted'", () => {
      const err = { message: "execution reverted: Poster not allowed" };
      expect(getErrorMessage(err as never)).toBe("Transaction reverted: Poster not allowed");
    });

    it("falls back when no reason string follows", () => {
      expect(getErrorMessage({ message: "execution reverted" } as never)).toBe("Transaction reverted.");
    });
  });

  describe("nested provider errors", () => {
    it("unwraps a message buried under info.error", () => {
      const err = {
        message: "could not coalesce error",
        info: { error: { message: "execution reverted: Not the owner" } }
      };
      expect(getErrorMessage(err as never)).toBe("Transaction reverted: Not the owner");
    });

    it("prefers shortMessage over the raw message", () => {
      const err = { shortMessage: "execution reverted: Paused", message: "a much longer ethers dump" };
      expect(getErrorMessage(err as never)).toBe("Transaction reverted: Paused");
    });
  });

  describe("network failures", () => {
    it.each(["Failed to fetch", "network error", "timeout of 10000ms exceeded"])(
      "maps %j to the network message",
      (text) => {
        expect(getErrorMessage({ message: text } as never)).toMatch(/Network\/RPC error/);
      }
    );

    it("maps malformed JSON to the RPC response message", () => {
      expect(getErrorMessage({ message: "Unexpected end of JSON input" } as never)).toMatch(
        /malformed response/
      );
    });
  });

  describe("fallbacks", () => {
    it("returns a default for an empty error", () => {
      expect(getErrorMessage(null)).toBe("Transaction failed.");
      expect(getErrorMessage(undefined)).toBe("Transaction failed.");
      expect(getErrorMessage({} as never)).toBe("Transaction failed.");
    });

    it("passes an unrecognised message through unchanged", () => {
      expect(getErrorMessage({ message: "Something specific went wrong" } as never)).toBe(
        "Something specific went wrong"
      );
    });

    it("ignores blank strings when picking a message", () => {
      const err = { shortMessage: "   ", reason: "", message: "the real one" };
      expect(getErrorMessage(err as never)).toBe("the real one");
    });
  });
});

describe("setStatusFromError", () => {
  it("writes the mapped message and returns it", () => {
    const setStatus = vi.fn();
    const returned = setStatusFromError(setStatus, { code: 4001 } as never);

    expect(setStatus).toHaveBeenCalledWith("Transaction rejected in wallet.");
    expect(returned).toBe("Transaction rejected in wallet.");
  });
});
