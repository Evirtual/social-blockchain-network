import { useCallback } from "react";

import { isSamePost } from "../services/postActions/matchPost";
import { runSocialAction } from "../services/actions/runSocialAction";

import type { Post, PostComment } from "@types";
import type { TransactionResponse } from "ethers";
import type { TransactionReceipt } from "ethers";
import type { WriteContractFactory } from "@features/contract";
import { commentKey } from "@features/post/services";
import { parseCommentAddedFromReceipt } from "../services/commentAddedFromReceipt";

type FeedLike = {
  posts: Post[];
  setPosts: React.Dispatch<React.SetStateAction<Post[]>>;
  setPostComments: React.Dispatch<React.SetStateAction<Record<string, PostComment[]>>>;
  loadCommentsForPost: (tokenId: string, postChainId?: string | null) => Promise<void>;
};

type RunContractTxLike = <T = void>(
  label: string,
  send: () => Promise<TransactionResponse>,
  onReceipt?: (receipt: TransactionReceipt) => Promise<T> | T
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
              (receipt) => {
                try {
                  const ev = parseCommentAddedFromReceipt({
                    receipt,
                    contractInterface: writeContract.interface,
                    contractAddress: String(writeContract.target ?? ""),
                    expectedTokenId: tokenIdBig,
                    expectedParentId: 0n
                  });
                  if (!ev) return true;

                  const key = commentKey(postChainId ?? chainId, tokenId);
                  feed.setPostComments((prev) => {
                    // Only patch the modal if comments are already loaded.
                    if (!Object.prototype.hasOwnProperty.call(prev, key)) return prev;
                    const existing = prev[key] ?? [];
                    if (existing.some((c) => c.commentId === ev.commentId)) return prev;
                    const nextItem: PostComment = {
                      commentId: ev.commentId,
                      tokenId: ev.tokenId,
                      author: ev.commenter,
                      parentId: ev.parentId,
                      comment: ev.comment || text,
                      deleted: false,
                      edited: false,
                      likeCount: 0,
                      saveCount: 0,
                      tipWei: 0n,
                      likedByMe: false,
                      savedByMe: false,
                      txHash: receipt.hash,
                      blockNumber: receipt.blockNumber
                    };
                    return { ...prev, [key]: [...existing, nextItem] };
                  });
                } catch {
                  // ignore
                }
                return true;
              }
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
            return true;
          }

          return false;
        }
      });

      return result.ok ? result.value : false;
    },
    [walletAddress, chainId, ensureMatchingNetwork, getWriteContract, runContractTx, feed, setStatus]
  );

  return {
    handleAction
  };
}
