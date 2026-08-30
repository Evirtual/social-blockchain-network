import { formatEther } from "ethers";

type BalanceReader = {
  runner?: {
    provider?: {
      getBalance: (address: string) => Promise<bigint>;
    } | null;
  } | null;
};

/**
 * Returns a user-facing message when the wallet cannot fund the tip, or null
 * when it can (or when the balance could not be read).
 *
 * The tip value alone is compared against the balance: gas is paid on top, so
 * a balance at or below the value can never succeed. Estimating gas to get an
 * exact figure is not an option here, because estimation is precisely what
 * fails for an underfunded transaction.
 */
export async function describeTipShortfall(
  contract: BalanceReader,
  walletAddress: string | null,
  valueWei: bigint
): Promise<string | null> {
  const address = (walletAddress ?? "").trim();
  if (!address) return null;

  const provider = contract?.runner?.provider;
  if (!provider) return null;

  let balance: bigint;
  try {
    balance = await provider.getBalance(address);
  } catch {
    // Reading the balance is a courtesy check. If the RPC is unavailable, let
    // the transaction proceed and report whatever the chain says.
    return null;
  }

  if (balance > valueWei) return null;

  return `Not enough balance to tip ${trimAmount(valueWei)}. You have ${trimAmount(balance)}, and gas is charged on top.`;
}

/**
 * Six decimals is enough to tell two testnet balances apart while staying
 * readable; the full eighteen render as an unreadable run of digits.
 */
function trimAmount(wei: bigint): string {
  const text = formatEther(wei);
  if (!text.includes(".")) return text;

  const [whole = "0", fraction = ""] = text.split(".");
  const trimmed = fraction.slice(0, 6).replace(/0+$/, "");
  if (trimmed) return `${whole}.${trimmed}`;

  // Nothing left after the decimal point: a whole amount such as 1.0 reads as
  // "1", and only a value below the shown precision needs the "less than"
  // form, which must never be applied to an amount that has a whole part.
  if (whole !== "0") return whole;
  return wei > 0n ? "<0.000001" : "0";
}
