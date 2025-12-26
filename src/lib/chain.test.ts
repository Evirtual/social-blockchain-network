import { describe, expect, it, vi } from "vitest";
import { getExplorerTxUrl, getNativeSymbol, getNetworkBadgeLabel } from "./chain";

describe("chain", () => {
  it("getExplorerTxUrl returns null when env is missing", () => {
    const envAny = import.meta.env as any;
    const keys = [
      "VITE_EXPLORER_BASE_URL_8453",
      "VITE_EXPLORER_BASE_URL_11155111",
      "VITE_EXPLORER_BASE_URL_1",
      "VITE_EXPLORER_BASE_URL_84532",
      "VITE_EXPLORER_BASE_URL_999"
    ];
    const prev: Record<string, unknown> = {};
    for (const k of keys) {
      prev[k] = envAny[k];
      envAny[k] = "";
    }

    expect(getExplorerTxUrl("8453", "0xabc")).toBeNull();
    expect(getExplorerTxUrl("11155111", "0xabc")).toBeNull();
    expect(getExplorerTxUrl("1", "0xabc")).toBeNull();
    expect(getExplorerTxUrl("84532", "0xabc")).toBeNull();
    expect(getExplorerTxUrl("999", "0xabc")).toBeNull();
    expect(getExplorerTxUrl(null, "0xabc")).toBeNull();

    for (const k of keys) {
      envAny[k] = prev[k];
    }
  });

  it("getExplorerTxUrl uses env base URL", () => {
    vi.stubEnv("VITE_EXPLORER_BASE_URL_8453", "https://example.explorer/");
    expect(getExplorerTxUrl("8453", "0xabc")).toBe("https://example.explorer/tx/0xabc");
    vi.unstubAllEnvs();
  });

  it("getNativeSymbol returns BNB for BSC", () => {
    expect(getNativeSymbol("56")).toBe("BNB");
    expect(getNativeSymbol("97")).toBe("BNB");
    expect(getNativeSymbol("1")).toBe("ETH");
  });

  it("getNetworkBadgeLabel maps common ids", () => {
    expect(getNetworkBadgeLabel("1")).toBe("ETH");
    expect(getNetworkBadgeLabel("11155111")).toBe("eth-test");
    expect(getNetworkBadgeLabel("8453")).toBe("BASE");
    expect(getNetworkBadgeLabel("84532")).toBe("base-test");
    expect(getNetworkBadgeLabel("56")).toBe("BSC");
    expect(getNetworkBadgeLabel("97")).toBe("bsc-test");
    expect(getNetworkBadgeLabel("999")).toBe("#999");
    expect(getNetworkBadgeLabel(null)).toBe("");
  });
});
