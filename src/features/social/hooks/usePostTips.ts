import { useCallback } from "react";
import { parseEther } from "ethers";

import { isSamePost } from "../services/postActions/matchPost";
import { parseTipAmountRaw } from "../services/postActions/tipAmount";
import { describeTipShortfall } from "../services/postActions/tipBalance";
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
    async (
      tokenId: string,
      amountRaw: string,
      postChainId?: string | null,
      supportBps?: number | null,
      savePreference?: boolean
    ) => {
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

          const supportBpsInt = Number.isFinite(supportBps as number) ? Number(supportBps) : 0;
          if (supportBpsInt < 0 || supportBpsInt > 1000) {
            setStatus("Support percentage must be 0-10%.");
            return false;
          }

          // Catch the shortfall here rather than letting gas estimation fail:
          // an underfunded tip reverts with no revert data, which reads as a
          // generic contract failure by the time it reaches the user.
          const shortfall = await describeTipShortfall(writeContract, walletAddress, valueWei);
          if (shortfall) {
            setStatus(shortfall);
            return false;
          }

          const hasSupport = supportBpsInt > 0;
          const ok = await runContractTx<boolean>(
            "Tip",
            () =>
              hasSupport
                ? writeContract.tipPostWithSupport(tokenIdBig, supportBpsInt, Boolean(savePreference), {
                    value: valueWei
                  })
                : writeContract.tipPost(tokenIdBig, { value: valueWei }),
            () => true
          );
          if (!ok) return false;

          const authorWei = hasSupport
            ? valueWei - (valueWei * BigInt(supportBpsInt)) / 10000n
            : valueWei;

          feed.setPosts((prev) =>
            prev.map((p) => {
              if (!isSamePost({ post: p, tokenId, postChainId })) return p;
              return { ...p, tipsWei: p.tipsWei + authorWei };
            })
          );
          void refreshWalletPanel();
          return true;
        }
      });
      return result.ok ? result.value : false;
    },
    [
      walletAddress,
      setStatus,
      ensureMatchingNetwork,
      getWriteContract,
      runContractTx,
      feed,
      refreshWalletPanel
    ]
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
