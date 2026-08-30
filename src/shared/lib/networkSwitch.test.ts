import { afterEach, describe, expect, it, vi } from "vitest";
import { formatAddEthereumChainId, requestNetworkSwitch } from "./networkSwitch";

const BASE_SEPOLIA = 84532;

const ADD_PARAM = {
  chainId: "0x14a34",
  chainName: "Base Sepolia",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: ["https://base-sepolia-rpc.publicnode.com"]
};

function withWallet(request: (args: { method: string }) => Promise<unknown>) {
  (window as unknown as { ethereum?: unknown }).ethereum = { request };
}

afterEach(() => {
  delete (window as unknown as { ethereum?: unknown }).ethereum;
});

describe("requestNetworkSwitch", () => {
  it("succeeds when the wallet switches", async () => {
    withWallet(vi.fn().mockResolvedValue(null));
    await expect(requestNetworkSwitch(BASE_SEPOLIA, "1")).resolves.toEqual({ ok: true });
  });

  it("short-circuits when already on the target chain", async () => {
    const request = vi.fn();
    withWallet(request);

    await expect(requestNetworkSwitch(BASE_SEPOLIA, String(BASE_SEPOLIA))).resolves.toEqual({ ok: true });
    expect(request).not.toHaveBeenCalled();
  });

  describe("failures explain themselves", () => {
    // Regression: every failure returned a bare false, so the dialog closed
    // silently and a rejected switch looked like nothing had happened.
    it("reports a rejection in the wallet", async () => {
      withWallet(vi.fn().mockRejectedValue(Object.assign(new Error("denied"), { code: 4001 })));

      const result = await requestNetworkSwitch(BASE_SEPOLIA, "1");

      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/cancelled/i);
    });

    it("reads a rejection wrapped by the provider", async () => {
      withWallet(vi.fn().mockRejectedValue({ data: { originalError: { code: 4001 } } }));
      await expect(requestNetworkSwitch(BASE_SEPOLIA, "1")).resolves.toMatchObject({ ok: false });
    });

    it("reports when no wallet is present", async () => {
      const result = await requestNetworkSwitch(BASE_SEPOLIA, "1");

      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/Connect a wallet/i);
    });

    it("reports a generic failure with a reason", async () => {
      withWallet(vi.fn().mockRejectedValue(new Error("provider exploded")));

      const result = await requestNetworkSwitch(BASE_SEPOLIA, "1");

      expect(result.ok).toBe(false);
      expect(result.error).toBeTruthy();
    });
  });

  describe("adding an unknown chain", () => {
    it("adds then switches when the wallet does not know the chain", async () => {
      const request = vi
        .fn()
        .mockRejectedValueOnce(Object.assign(new Error("unknown"), { code: 4902 }))
        .mockResolvedValue(null);
      withWallet(request);

      await expect(requestNetworkSwitch(BASE_SEPOLIA, "1", ADD_PARAM)).resolves.toEqual({ ok: true });
      expect(request).toHaveBeenCalledTimes(3); // switch, add, switch
    });

    it("does not attempt to add without the chain parameters", async () => {
      const request = vi.fn().mockRejectedValue(Object.assign(new Error("unknown"), { code: 4902 }));
      withWallet(request);

      await expect(requestNetworkSwitch(BASE_SEPOLIA, "1")).resolves.toMatchObject({ ok: false });
      expect(request).toHaveBeenCalledTimes(1);
    });

    it("reports a rejection of the add prompt as a cancellation", async () => {
      const request = vi
        .fn()
        .mockRejectedValueOnce(Object.assign(new Error("unknown"), { code: 4902 }))
        .mockRejectedValueOnce(Object.assign(new Error("denied"), { code: 4001 }));
      withWallet(request);

      const result = await requestNetworkSwitch(BASE_SEPOLIA, "1", ADD_PARAM);

      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/cancelled/i);
    });
  });
});

describe("formatAddEthereumChainId", () => {
  it("renders the chain id as hex", () => {
    expect(formatAddEthereumChainId(BASE_SEPOLIA)).toBe("0x14a34");
    expect(formatAddEthereumChainId(1)).toBe("0x1");
  });
});
