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

describe("amount formatting", () => {
  const wallet = "0x1111111111111111111111111111111111111111";

  it("trims a full-precision balance to something readable", async () => {
    const contract = contractWithBalance(79773680895274633n);
    const message = await describeTipShortfall(contract, wallet, parseEther("1"));

    expect(message).toContain("0.079773");
    expect(message).not.toContain("0.079773680895274633");
  });

  it("drops trailing zeros rather than padding", async () => {
    const contract = contractWithBalance(parseEther("0.5"));
    await expect(describeTipShortfall(contract, wallet, parseEther("1"))).resolves.toContain("0.5");
  });

  it("does not render a tiny non-zero balance as zero", async () => {
    // Showing "0" would suggest an empty wallet when it holds dust.
    const contract = contractWithBalance(1n);
    const message = await describeTipShortfall(contract, wallet, parseEther("1"));

    expect(message).toContain("<0.000001");
    expect(message).not.toMatch(/You have 0,/);
  });

  it("renders a genuinely empty wallet as zero", async () => {
    const contract = contractWithBalance(0n);
    await expect(describeTipShortfall(contract, wallet, parseEther("1"))).resolves.toContain("You have 0,");
  });
});

describe("whole amounts", () => {
  const wallet = "0x1111111111111111111111111111111111111111";

  it("renders a whole tip amount as a whole number", async () => {
    // Regression: 1.0 trims to an empty fraction, which briefly fell through
    // to the dust case and displayed the tip as "<0.000001".
    const contract = contractWithBalance(parseEther("0.05"));
    const message = await describeTipShortfall(contract, wallet, parseEther("1"));

    expect(message).toMatch(/tip 1[.,]/);
    expect(message).not.toContain("tip <0.000001");
  });

  it.each([
    ["2", "tip 2"],
    ["10", "tip 10"],
    ["1.5", "tip 1.5"]
  ])("renders %s correctly", async (amount, expected) => {
    const contract = contractWithBalance(0n);
    await expect(describeTipShortfall(contract, wallet, parseEther(amount))).resolves.toContain(expected);
  });
});
