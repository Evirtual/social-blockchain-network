import { describe, expect, it } from "vitest";
import { getExplorerTxUrl, getNativeSymbol, getNetworkBadgeLabel } from "./chain";

describe("chain", () => {
  it("getExplorerTxUrl supports known chains", () => {
    expect(getExplorerTxUrl("8453", "0xabc")).toContain("basescan");
    expect(getExplorerTxUrl("11155111", "0xabc")).toContain("sepolia.etherscan.io");
    expect(getExplorerTxUrl("1", "0xabc")).toContain("etherscan.io");
    expect(getExplorerTxUrl("84532", "0xabc")).toContain("sepolia.basescan.org");
    expect(getExplorerTxUrl("999", "0xabc")).toBeNull();
    expect(getExplorerTxUrl(null, "0xabc")).toBeNull();
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
