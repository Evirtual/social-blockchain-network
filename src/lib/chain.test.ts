import { describe, expect, it } from "vitest";
import { getExplorerTxUrl, getNativeSymbol, getNetworkBadgeLabel } from "./chain";

describe("chain", () => {
  it("getExplorerTxUrl supports known chains", () => {
    expect(getExplorerTxUrl("8453", "0xabc")).toContain("basescan");
    expect(getExplorerTxUrl("11155111", "0xabc")).toContain("sepolia.etherscan.io");
    expect(getExplorerTxUrl(null, "0xabc")).toBeNull();
  });

  it("getNativeSymbol returns BNB for BSC", () => {
    expect(getNativeSymbol("56")).toBe("BNB");
    expect(getNativeSymbol("97")).toBe("BNB");
    expect(getNativeSymbol("1")).toBe("ETH");
  });

  it("getNetworkBadgeLabel maps common ids", () => {
    expect(getNetworkBadgeLabel("8453")).toBe("BASE");
    expect(getNetworkBadgeLabel("84532")).toBe("BASE-SEP");
    expect(getNetworkBadgeLabel("56")).toBe("BSC");
    expect(getNetworkBadgeLabel("97")).toBe("BSC-T");
  });
});
