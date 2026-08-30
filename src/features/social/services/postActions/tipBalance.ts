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

  return `Not enough balance to tip ${formatEther(valueWei)}. You have ${formatEther(balance)}, and gas is charged on top.`;
}
