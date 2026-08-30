import { useCallback } from "react";
import { parseEther } from "ethers";

import { isSamePost } from "../services/postActions/matchPost";
import { parseTipAmountRaw } from "../services/postActions/tipAmount";
import { describeTipShortfall } from "../services/postActions/tipBalance";
import { runSocialAction } from "../services/actions/runSocialAction";
import { tipRejected, tipSucceeded } from "../services/postActions/tipOutcome";

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
      // Kept alongside setStatus so the reason can travel back to the caller.
      // The status itself is only rendered in the sidebar, and reading it back
      // after the attempt races the render that publishes it.
      let rejection = "";
      const reject = (message: string) => {
        setStatus(message);
        rejection = message;
        return false;
      };

      const result = await runSocialAction<boolean>({
        walletAddress,
        setStatus,
        ensureMatchingNetwork,
        postChainId,
        action: async () => {
          const parsed = parseTipAmountRaw(amountRaw);
          if (!parsed.ok) return reject(parsed.error);

          const valueWei = parseEther(parsed.raw);
          const writeContract = await getWriteContract();
          const tokenIdBig = BigInt(tokenId);

          const supportBpsInt = Number.isFinite(supportBps as number) ? Number(supportBps) : 0;
          if (supportBpsInt < 0 || supportBpsInt > 1000) return reject("Support percentage must be 0-10%.");

          // Catch the shortfall here rather than letting gas estimation fail:
          // an underfunded tip reverts with no revert data, which reads as a
          // generic contract failure by the time it reaches the user.
          const shortfall = await describeTipShortfall(writeContract, walletAddress, valueWei);
          if (shortfall) return reject(shortfall);

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
      const ok = result.ok ? result.value : false;
      return ok ? tipSucceeded : tipRejected(rejection || "Tip failed.");
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
