import { useCallback } from "react";
import { setStatusFromError, type ErrorInput } from "@shared/lib/errors";
import { fail, ok, type ActionResult } from "@shared/lib/result";

type WalletLike = {
  connectWallet: () => Promise<string | null>;
  refreshWalletPanel: () => Promise<void>;
};

type ContractLike = {
  refreshContractState: () => Promise<void>;
  ensureContractDeployedOnCurrentNetwork: () => Promise<void>;
};

type FeedLike = {
  refreshFeed: (accountOverride?: string | null) => Promise<void>;
};

export function useConnectWallet(params: {
  wallet: WalletLike;
  contract: ContractLike;
  feed: FeedLike;
  setStatus: (s: string) => void;
  triggerConnectNudge: () => void;
}) {
  const { wallet, contract, feed, setStatus, triggerConnectNudge } = params;

  return useCallback(async (): Promise<ActionResult<void>> => {
    const addr = await wallet.connectWallet();
    if (!addr) {
      triggerConnectNudge();
      return fail();
    }

    try {
      await contract.refreshContractState();
    } catch {
      // ignore
    }

    try {
      await contract.ensureContractDeployedOnCurrentNetwork();
    } catch (err) {
      setStatusFromError(setStatus, err as ErrorInput);
      return fail();
    }

    void wallet.refreshWalletPanel();
    void feed.refreshFeed(addr);
    return ok(undefined);
  }, [wallet, contract, feed, setStatus, triggerConnectNudge]);
}
