import { useCallback } from "react";

import { isSamePost } from "../services/postActions/matchPost";
import { buildTokenKey, updateSessionTokenKeys } from "../services/postActions/sessionTokenKeys";
import { runSocialAction } from "../services/actions/runSocialAction";

import type { Post } from "@types";
import type { TransactionResponse } from "ethers";
import type { WriteContractFactory } from "@features/contract";

type FeedLike = {
  posts: Post[];
  setPosts: React.Dispatch<React.SetStateAction<Post[]>>;
  loadCommentsForPost: (tokenId: string, postChainId?: string | null) => Promise<void>;
};

type RunContractTxLike = <T = void>(
  label: string,
  send: () => Promise<TransactionResponse>,
  onSuccess?: () => T
) => Promise<T | undefined>;

export function usePostEngagement(args: {
  walletAddress: string | null;
  chainId: string | null;
  getWriteContract: WriteContractFactory;
  runContractTx: RunContractTxLike;
  feed: FeedLike;
  setStatus: (value: string) => void;
  ensureMatchingNetwork: (postChainId?: string | null) => boolean;
}) {
  const { walletAddress, chainId, getWriteContract, runContractTx, feed, setStatus, ensureMatchingNetwork } = args;

  const handleAction = useCallback(
    async (tokenId: string, action: "like" | "comment" | "save", postChainId?: string | null, comment?: string) => {
      const result = await runSocialAction<boolean>({
        walletAddress,
        setStatus,
        ensureMatchingNetwork,
        postChainId,
        action: async () => {
          const activeWallet = walletAddress;
          if (!activeWallet) return false;

          const addressLower = activeWallet.toLowerCase();
          const tokenKey = buildTokenKey({ tokenId, postChainId, currentChainId: chainId });

          const writeContract = await getWriteContract();
          const tokenIdBig = BigInt(tokenId);

          if (action === "comment") {
            const text = (comment ?? "").trim();
            if (!text) {
              setStatus("Write a comment before signing.");
              return false;
            }
            const ok = await runContractTx<boolean>(
              "Comment",
              () => writeContract.commentPost(tokenIdBig, text),
              () => true
            );
            if (!ok) return false;

            feed.setPosts((prev) =>
              prev.map((post) => {
                if (!isSamePost({ post, tokenId, postChainId })) return post;
                return { ...post, comments: post.comments + 1 };
              })
            );
            void feed.loadCommentsForPost(tokenId, postChainId ?? chainId);
            return true;
          }

          if (action === "like") {
            const already = (await writeContract.hasLiked(tokenIdBig, activeWallet)) as boolean;
            const ok = await runContractTx<boolean>(
              already ? "Unlike" : "Like",
              () => (already ? writeContract.unlikePost(tokenIdBig) : writeContract.likePost(tokenIdBig)),
              () => true
            );
            if (!ok) return false;

            feed.setPosts((prev) =>
              prev.map((post) => {
                if (!isSamePost({ post, tokenId, postChainId })) return post;
                const next = already ? Math.max(0, post.likes - 1) : post.likes + 1;
                return { ...post, likes: next, likedByMe: !already };
              })
            );

            // Persist for the Saved/Liked profile views (fast reload without rescans).
            updateSessionTokenKeys({
              prefix: "likesTokenKeysByAddress:",
              addressLower,
              tokenKey,
              add: !already
            });
            return true;
          }

          if (action === "save") {
            const already = (await writeContract.hasSaved(tokenIdBig, activeWallet)) as boolean;
            const ok = await runContractTx<boolean>(
              already ? "Unsave" : "Save",
              () => (already ? writeContract.unsavePost(tokenIdBig) : writeContract.savePost(tokenIdBig)),
              () => true
            );
            if (!ok) return false;

            feed.setPosts((prev) =>
              prev.map((post) => {
                if (!isSamePost({ post, tokenId, postChainId })) return post;
                const next = already ? Math.max(0, post.saves - 1) : post.saves + 1;
                return { ...post, saves: next, savedByMe: !already };
              })
            );

            // Persist for the Saved/Liked profile views (fast reload without rescans).
            updateSessionTokenKeys({
              prefix: "savedTokenKeysByAddress:",
              addressLower,
              tokenKey,
              add: !already
            });
            return true;
          }

          return false;
        }
      });

      return result ?? false;
    },
    [walletAddress, chainId, ensureMatchingNetwork, getWriteContract, runContractTx, feed, setStatus]
  );

  return {
    handleAction
  };
}
