import { describe, expect, it, vi } from "vitest";
import { parseEther } from "ethers";
import { describeTipShortfall } from "./tipBalance";

function contractWithBalance(balance: bigint) {
  return { runner: { provider: { getBalance: vi.fn().mockResolvedValue(balance) } } };
}

describe("describeTipShortfall", () => {
  const wallet = "0x1111111111111111111111111111111111111111";

  it("allows a tip when the balance exceeds the value", async () => {
    const contract = contractWithBalance(parseEther("1"));
    await expect(describeTipShortfall(contract, wallet, parseEther("0.01"))).resolves.toBeNull();
  });

  it("blocks a tip when the balance is below the value", async () => {
    const contract = contractWithBalance(parseEther("0.001"));

    const message = await describeTipShortfall(contract, wallet, parseEther("0.5"));

    expect(message).toMatch(/Not enough balance/);
    expect(message).toContain("0.5");
    expect(message).toContain("0.001");
  });

  it("blocks a tip that would consume the entire balance, since gas is extra", async () => {
    const contract = contractWithBalance(parseEther("0.5"));
    await expect(describeTipShortfall(contract, wallet, parseEther("0.5"))).resolves.toMatch(
      /Not enough balance/
    );
  });

  it("blocks a tip from an empty wallet", async () => {
    const contract = contractWithBalance(0n);
    await expect(describeTipShortfall(contract, wallet, 1n)).resolves.toMatch(/Not enough balance/);
  });

  it("never mentions images or metadata", async () => {
    const contract = contractWithBalance(0n);
    const message = await describeTipShortfall(contract, wallet, parseEther("1"));
    expect(message).not.toMatch(/image|metadata|IPFS/i);
  });

  describe("when the balance cannot be read", () => {
    it("allows the transaction through if the RPC call fails", async () => {
      const contract = {
        runner: { provider: { getBalance: vi.fn().mockRejectedValue(new Error("RPC down")) } }
      };
      await expect(describeTipShortfall(contract, wallet, parseEther("1"))).resolves.toBeNull();
    });

    it("allows the transaction through if there is no provider", async () => {
      await expect(describeTipShortfall({ runner: null }, wallet, parseEther("1"))).resolves.toBeNull();
    });

    it("allows the transaction through if there is no wallet address", async () => {
      const contract = contractWithBalance(0n);
      await expect(describeTipShortfall(contract, null, parseEther("1"))).resolves.toBeNull();
      await expect(describeTipShortfall(contract, "  ", parseEther("1"))).resolves.toBeNull();
    });
  });
});
