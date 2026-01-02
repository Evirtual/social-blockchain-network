import { useCallback } from "react";
import { parseEther } from "ethers";

import { isSamePost } from "../services/postActions/matchPost";
import { parseTipAmountRaw } from "../services/postActions/tipAmount";
import { runSocialAction } from "../services/actions/runSocialAction";

import type { Post } from "@types";
import type { TransactionResponse } from "ethers";
import type { WriteContractFactory } from "@features/contract";

type FeedLike = {
  setPosts: React.Dispatch<React.SetStateAction<Post[]>>;
};

type RunContractTxLike = <T = void>(
  label: string,
  send: () => Promise<TransactionResponse>,
  onSuccess?: () => T
) => Promise<T | undefined>;

export function usePostTips(args: {
  walletAddress: string | null;
  refreshWalletPanel: () => Promise<void>;
  getWriteContract: WriteContractFactory;
  runContractTx: RunContractTxLike;
  feed: FeedLike;
  setStatus: (value: string) => void;
  ensureMatchingNetwork: (postChainId?: string | null) => boolean;
}) {
  const {
    walletAddress,
    refreshWalletPanel,
    getWriteContract,
    runContractTx,
    feed,
    setStatus,
    ensureMatchingNetwork
  } = args;

  const handleTip = useCallback(
    async (tokenId: string, amountRaw: string, postChainId?: string | null) => {
      const result = await runSocialAction<boolean>({
        walletAddress,
        setStatus,
        ensureMatchingNetwork,
        postChainId,
        action: async () => {
          const parsed = parseTipAmountRaw(amountRaw);
          if (!parsed.ok) {
            setStatus(parsed.error);
            return false;
          }

          const valueWei = parseEther(parsed.raw);
          const writeContract = await getWriteContract();
          const tokenIdBig = BigInt(tokenId);

          const ok = await runContractTx<boolean>(
            "Tip",
            () => writeContract.tipPost(tokenIdBig, { value: valueWei }),
            () => true
          );
          if (!ok) return false;

          feed.setPosts((prev) =>
            prev.map((p) => {
              if (!isSamePost({ post: p, tokenId, postChainId })) return p;
              return { ...p, tipsWei: p.tipsWei + valueWei };
            })
          );
          void refreshWalletPanel();
          return true;
        }
      });
      return result ?? false;
    },
    [walletAddress, ensureMatchingNetwork, getWriteContract, runContractTx, feed, refreshWalletPanel, setStatus]
  );

  const withdrawTips = useCallback(
    async () => {
      await runSocialAction<void>({
        walletAddress,
        setStatus,
        action: async () => {
          const writeContract = await getWriteContract();
          await runContractTx("Withdraw tips", () => writeContract.withdrawTips());
          void refreshWalletPanel();
        }
      });
    },
    [walletAddress, getWriteContract, runContractTx, refreshWalletPanel, setStatus]
  );

  return {
    handleTip,
    withdrawTips
  };
}
