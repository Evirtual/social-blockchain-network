import { useCallback } from "react";
import { parseEther } from "ethers";

import { commentKey } from "@features/post/services";
import { isSamePost } from "../services/postActions/matchPost";
import { parseTipAmountRaw } from "../services/postActions/tipAmount";
import { runSocialAction } from "../services/actions/runSocialAction";

import type { Post, PostComment } from "@types";
import type { TransactionResponse } from "ethers";
import type { TransactionReceipt } from "ethers";
import type { WriteContractFactory } from "@features/contract";
import { parseCommentAddedFromReceipt } from "../services/commentAddedFromReceipt";
import { markCommentDeleted } from "@shared/lib/deletedCommentsCache";

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

export function useCommentActions(args: {
  walletAddress: string | null;
  chainId: string | null;
  refreshWalletPanel: () => Promise<void>;
  getWriteContract: WriteContractFactory;
  runContractTx: RunContractTxLike;
  feed: FeedLike;
  setStatus: (value: string) => void;
  ensureMatchingNetwork: (postChainId?: string | null) => boolean;
}) {
  const { walletAddress, chainId, refreshWalletPanel, getWriteContract, runContractTx, feed, setStatus, ensureMatchingNetwork } = args;

  const updateCommentsForPost = useCallback(
    (tokenId: string, postChainId: string | null | undefined, update: (prev: PostComment[]) => PostComment[]) => {
      const key = commentKey(postChainId ?? chainId, tokenId);
      feed.setPostComments((prev) => {
        const list = prev[key] ?? [];
        return { ...prev, [key]: update(list) };
      });
    },
    [feed, chainId]
  );

  const runGuarded = useCallback(
    async <T,>(postChainId: string | null | undefined, action: () => Promise<T>) =>
      runSocialAction<T>({
        walletAddress,
        setStatus,
        ensureMatchingNetwork,
        postChainId,
        action
      }),
    [walletAddress, setStatus, ensureMatchingNetwork]
  );

  const replyToComment = useCallback(
    async (tokenId: string, parentCommentId: string, comment: string, postChainId?: string | null) => {
      const result = await runGuarded<boolean>(postChainId, async () => {
        const text = (comment ?? "").trim();
        if (!text) {
          setStatus("Write a reply before signing.");
          return false;
        }

        const writeContract = await getWriteContract();
        const ok = await runContractTx<boolean>(
          "Reply",
          () => writeContract.replyToComment(BigInt(tokenId), BigInt(parentCommentId), text),
          (receipt) => {
            try {
              const tokenIdBig = BigInt(tokenId);
              const parentIdBig = BigInt(parentCommentId);

              const ev = parseCommentAddedFromReceipt({
                receipt,
                contractInterface: writeContract.interface,
                contractAddress: String(writeContract.target ?? ""),
                expectedTokenId: tokenIdBig,
                expectedParentId: parentIdBig
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
      });
      return result.ok ? result.value : false;
    },
    [runGuarded, getWriteContract, runContractTx, feed, chainId, setStatus]
  );

  const editComment = useCallback(
    async (tokenId: string, commentId: string, comment: string, postChainId?: string | null) => {
      const result = await runGuarded<boolean>(postChainId, async () => {
        const text = (comment ?? "").trim();
        if (!text) {
          setStatus("Write a comment before signing.");
          return false;
        }

        const writeContract = await getWriteContract();
        const ok = await runContractTx<boolean>(
          "Edit comment",
          () => writeContract.editComment(BigInt(tokenId), BigInt(commentId), text),
          () => true
        );
        if (!ok) return false;

        updateCommentsForPost(tokenId, postChainId, (prev) =>
          prev.map((c) => (c.commentId === commentId ? { ...c, comment: text, edited: true } : c))
        );
        return true;
      });
      return result.ok ? result.value : false;
    },
    [runGuarded, getWriteContract, runContractTx, updateCommentsForPost, setStatus]
  );

  const deleteComment = useCallback(
    async (tokenId: string, commentId: string, postChainId?: string | null) => {
      const result = await runGuarded<boolean>(postChainId, async () => {
        const writeContract = await getWriteContract();
        const ok = await runContractTx<boolean>(
          "Delete comment",
          () => writeContract.deleteComment(BigInt(tokenId), BigInt(commentId)),
          () => true
        );
        if (!ok) return false;

        markCommentDeleted(postChainId ?? chainId, tokenId, commentId);
        updateCommentsForPost(tokenId, postChainId, (prev) => prev.filter((c) => c.commentId !== commentId));
        feed.setPosts((prev) =>
          prev.map((post) => {
            if (!isSamePost({ post, tokenId, postChainId })) return post;
            return { ...post, comments: Math.max(0, post.comments - 1) };
          })
        );
        return true;
      });
      return result.ok ? result.value : false;
    },
    [runGuarded, getWriteContract, runContractTx, updateCommentsForPost, feed]
  );

  const toggleLike = useCallback(
    async (tokenId: string, commentId: string, postChainId?: string | null) => {
      const result = await runGuarded<boolean>(postChainId, async () => {
        const activeWallet = walletAddress;
        if (!activeWallet) return false;

        const writeContract = await getWriteContract();
        const already = (await writeContract.hasLikedComment(BigInt(tokenId), BigInt(commentId), activeWallet)) as boolean;
        const ok = await runContractTx<boolean>(
          already ? "Unlike comment" : "Like comment",
          () =>
            already
              ? writeContract.unlikeComment(BigInt(tokenId), BigInt(commentId))
              : writeContract.likeComment(BigInt(tokenId), BigInt(commentId)),
          () => true
        );
        if (!ok) return false;

        updateCommentsForPost(tokenId, postChainId, (prev) =>
          prev.map((c) => {
            if (c.commentId !== commentId) return c;
            const count = c.likeCount ?? 0;
            const next = already ? Math.max(0, count - 1) : count + 1;
            return { ...c, likeCount: next, likedByMe: !already };
          })
        );
        return true;
      });
      return result.ok ? result.value : false;
    },
    [runGuarded, walletAddress, getWriteContract, runContractTx, updateCommentsForPost]
  );

  const toggleSave = useCallback(
    async (tokenId: string, commentId: string, postChainId?: string | null) => {
      const result = await runGuarded<boolean>(postChainId, async () => {
        const activeWallet = walletAddress;
        if (!activeWallet) return false;

        const writeContract = await getWriteContract();
        const already = (await writeContract.hasSavedComment(BigInt(tokenId), BigInt(commentId), activeWallet)) as boolean;
        const ok = await runContractTx<boolean>(
          already ? "Unsave comment" : "Save comment",
          () =>
            already
              ? writeContract.unsaveComment(BigInt(tokenId), BigInt(commentId))
              : writeContract.saveComment(BigInt(tokenId), BigInt(commentId)),
          () => true
        );
        if (!ok) return false;

        updateCommentsForPost(tokenId, postChainId, (prev) =>
          prev.map((c) => {
            if (c.commentId !== commentId) return c;
            const count = c.saveCount ?? 0;
            const next = already ? Math.max(0, count - 1) : count + 1;
            return { ...c, saveCount: next, savedByMe: !already };
          })
        );
        return true;
      });
      return result.ok ? result.value : false;
    },
    [runGuarded, walletAddress, getWriteContract, runContractTx, updateCommentsForPost]
  );

  const tipComment = useCallback(
    async (tokenId: string, commentId: string, amountRaw: string, postChainId?: string | null) => {
      const result = await runGuarded<boolean>(postChainId, async () => {
        const parsed = parseTipAmountRaw(amountRaw);
        if (!parsed.ok) {
          setStatus(parsed.error);
          return false;
        }

        const valueWei = parseEther(parsed.raw);
        const writeContract = await getWriteContract();

        const ok = await runContractTx<boolean>(
          "Tip comment",
          () => writeContract.tipComment(BigInt(tokenId), BigInt(commentId), { value: valueWei }),
          () => true
        );
        if (!ok) return false;

        updateCommentsForPost(tokenId, postChainId, (prev) =>
          prev.map((c) => (c.commentId === commentId ? { ...c, tipWei: (c.tipWei ?? 0n) + valueWei } : c))
        );
        void refreshWalletPanel();
        return true;
      });
      return result.ok ? result.value : false;
    },
    [runGuarded, getWriteContract, runContractTx, updateCommentsForPost, setStatus, refreshWalletPanel]
  );

  const reportPost = useCallback(
    async (tokenId: string, reason: string, postChainId?: string | null) => {
      const result = await runGuarded<boolean>(postChainId, async () => {
        const text = (reason ?? "").trim();
        if (!text) {
          setStatus("Write a report reason before submitting.");
          return false;
        }

        const writeContract = await getWriteContract();
        const ok = await runContractTx<boolean>(
          "Report post",
          () => writeContract.reportPost(BigInt(tokenId), text),
          () => true
        );
        if (!ok) return false;
        return true;
      });
      return result.ok ? result.value : false;
    },
    [runGuarded, getWriteContract, runContractTx, setStatus]
  );

  const reportComment = useCallback(
    async (tokenId: string, commentId: string, reason: string, postChainId?: string | null) => {
      const result = await runGuarded<boolean>(postChainId, async () => {
        const text = (reason ?? "").trim();
        if (!text) {
          setStatus("Write a report reason before submitting.");
          return false;
        }

        const writeContract = await getWriteContract();
        const ok = await runContractTx<boolean>(
          "Report comment",
          () => writeContract.reportComment(BigInt(tokenId), BigInt(commentId), text),
          () => true
        );
        if (!ok) return false;
        return true;
      });
      return result.ok ? result.value : false;
    },
    [runGuarded, getWriteContract, runContractTx, setStatus]
  );

  return {
    replyToComment,
    editComment,
    deleteComment,
    toggleLike,
    toggleSave,
    tipComment,
    reportPost,
    reportComment
  };
}
