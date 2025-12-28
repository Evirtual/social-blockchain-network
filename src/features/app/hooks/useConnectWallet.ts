import { useCallback } from "react";
import { getErrorMessage } from "@shared/lib/errors";

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

  return useCallback(async () => {
    const addr = await wallet.connectWallet();
    if (!addr) {
      triggerConnectNudge();
      return;
    }

    try {
      await contract.refreshContractState();
    } catch {
      // ignore
    }

    try {
      await contract.ensureContractDeployedOnCurrentNetwork();
    } catch (err) {
      setStatus(getErrorMessage(err));
    }

    void wallet.refreshWalletPanel();
    void feed.refreshFeed(addr);
  }, [wallet, contract, feed, setStatus, triggerConnectNudge]);
}
