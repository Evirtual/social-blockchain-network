import { useCallback } from "react";
import { parseEther } from "ethers";

import { getErrorMessage } from "@shared/lib/errors";
import { collectIpfsCidsFromTokenUri } from "../../ipfs";
import { requestConnectNudge } from "@shared/lib/connectNudge";
import { isSamePost } from "../services/postActions/matchPost";
import { buildTokenKey, updateSessionTokenKeys } from "../services/postActions/sessionTokenKeys";
import { parseTipAmountRaw } from "../services/postActions/tipAmount";

import type { Post, PostComment } from "@types";

type FeedLike = {
  posts: Post[];
  setPosts: React.Dispatch<React.SetStateAction<Post[]>>;
  refreshFeed: () => Promise<void>;
  loadCommentsForPost: (tokenId: string, postChainId?: string | null) => Promise<void>;
  setPostComments: React.Dispatch<React.SetStateAction<Record<string, PostComment[]>>>;
};

type RunContractTxLike = <T = unknown>(
  label: string,
  send: () => any,
  onSuccess?: () => T
) => Promise<T | undefined>;

type BestEffortUnpinSafe = (
  cids: Iterable<string>,
  exclude?: { chainId?: string | null; tokenIds?: Iterable<string> }
) => Promise<void>;

export function usePostActions(args: {
  walletAddress: string | null;
  chainId: string | null;
  refreshWalletPanel: () => Promise<void>;
  isOwner: boolean;
  ipfsConfigured: boolean;
  getReadContract: () => Promise<any>;
  getWriteContract: () => Promise<any>;
  runContractTx: RunContractTxLike;
  feed: FeedLike;
  setStatus: (value: string) => void;
  ensureMatchingNetwork: (postChainId?: string | null) => boolean;
  bestEffortUnpinCidsSafe: BestEffortUnpinSafe;
  editingTokenId: string | null;
  cancelEditPost: () => void;
}) {
  const {
    walletAddress,
    chainId,
    refreshWalletPanel,
    isOwner,
    ipfsConfigured,
    getReadContract,
    getWriteContract,
    runContractTx,
    feed,
    setStatus,
    ensureMatchingNetwork,
    bestEffortUnpinCidsSafe,
    editingTokenId,
    cancelEditPost
  } = args;

  const freezePost = useCallback(
    async (tokenId: string, postChainId?: string | null) => {
      try {
        if (!walletAddress) {
          requestConnectNudge();
          setStatus("Connect your wallet first.");
          return;
        }
        if (!ensureMatchingNetwork(postChainId)) return;

        const writeContract = await getWriteContract();
        const ok = await runContractTx<boolean>(
          "Freeze post",
          () => ((writeContract as any).freezePost(BigInt(tokenId)) as any),
          () => true
        );
        if (!ok) return;

        cancelEditPost();
        setStatus("Post frozen. Editing is now disabled for this token.");
      } catch (error) {
        setStatus(getErrorMessage(error));
      }
    },
    [walletAddress, ensureMatchingNetwork, getWriteContract, runContractTx, cancelEditPost, setStatus]
  );

  const burnPost = useCallback(
    async (tokenId: string, postChainId?: string | null) => {
      try {
        if (!walletAddress) {
          requestConnectNudge();
          setStatus("Connect your wallet first.");
          return;
        }
        if (!ensureMatchingNetwork(postChainId)) return;

        // Capture tokenURI + related IPFS CIDs before burn.
        let pinnedCids: Set<string> | null = null;
        try {
          if (ipfsConfigured) {
            const readContract = await getReadContract();
            const tokenIdBig = BigInt(tokenId);
            const oldTokenUri = (await (readContract as any).tokenURI(tokenIdBig)) as string;
            pinnedCids = await collectIpfsCidsFromTokenUri(oldTokenUri);
          }
        } catch {
          pinnedCids = null;
        }

        const writeContract = await getWriteContract();
        const tokenIdBig = BigInt(tokenId);
        const post = feed.posts.find((p) => p.tokenId === tokenId);
        const author = post?.author;
        const isMine = !!author && walletAddress.toLowerCase() === author.toLowerCase();
        const send =
          isOwner && !isMine
            ? () => (writeContract as any).adminBurnPost(tokenIdBig)
            : () => (writeContract as any).burnPost(tokenIdBig);

        await runContractTx("Burn post", send);

        // Best-effort cleanup: stop pinning the burned post's metadata/media.
        if (ipfsConfigured && pinnedCids) {
          void bestEffortUnpinCidsSafe(pinnedCids, { chainId: postChainId ?? chainId, tokenIds: [tokenId] });
        }

        if (editingTokenId === tokenId) {
          cancelEditPost();
        }

        feed.setPosts((prev) =>
          prev.filter((p) => {
            if (p.tokenId !== tokenId) return true;
            if (postChainId && p.chainId && p.chainId !== postChainId) return true;
            return false;
          })
        );
        feed.setPostComments((prev) => {
          if (!(tokenId in prev)) return prev;
          const { [tokenId]: _, ...rest } = prev;
          return rest;
        });

        await feed.refreshFeed();
      } catch (error) {
        setStatus(getErrorMessage(error));
      }
    },
    [
      walletAddress,
      ensureMatchingNetwork,
      ipfsConfigured,
      getReadContract,
      getWriteContract,
      isOwner,
      runContractTx,
      editingTokenId,
      cancelEditPost,
      feed,
      setStatus,
      bestEffortUnpinCidsSafe,
      chainId
    ]
  );

  const handleTip = useCallback(
    async (tokenId: string, amountRaw: string, postChainId?: string | null) => {
      try {
        if (!walletAddress) {
          requestConnectNudge();
          setStatus("Connect your wallet first.");
          return false;
        }
        if (!ensureMatchingNetwork(postChainId)) return false;

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
      } catch (error) {
        setStatus(getErrorMessage(error));
        return false;
      }
    },
    [walletAddress, ensureMatchingNetwork, getWriteContract, runContractTx, feed, refreshWalletPanel, setStatus]
  );

  const withdrawTips = useCallback(
    async () => {
      try {
        if (!walletAddress) {
          requestConnectNudge();
          setStatus("Connect your wallet first.");
          return;
        }

        const writeContract = await getWriteContract();
        await runContractTx("Withdraw tips", () => writeContract.withdrawTips());
        void refreshWalletPanel();
      } catch (error) {
        setStatus(getErrorMessage(error));
      }
    },
    [walletAddress, getWriteContract, runContractTx, refreshWalletPanel, setStatus]
  );

  const handleAction = useCallback(
    async (tokenId: string, action: "like" | "comment" | "save", postChainId?: string | null, comment?: string) => {
      try {
        if (!walletAddress) {
          requestConnectNudge();
          setStatus("Connect your wallet first.");
          return false;
        }
        if (!ensureMatchingNetwork(postChainId)) return false;

        const addressLower = walletAddress.toLowerCase();
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
          const already = (await (writeContract as any).hasLiked(tokenIdBig, walletAddress)) as boolean;
          const ok = await runContractTx<boolean>(
            already ? "Unlike" : "Like",
            () => ((already ? (writeContract as any).unlikePost(tokenIdBig) : writeContract.likePost(tokenIdBig)) as any),
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
          const already = (await (writeContract as any).hasSaved(tokenIdBig, walletAddress)) as boolean;
          const ok = await runContractTx<boolean>(
            already ? "Unsave" : "Save",
            () =>
              ((already
                ? (writeContract as any).unsavePost(tokenIdBig)
                : (writeContract as any).savePost(tokenIdBig)) as any),
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
      } catch (error) {
        setStatus(getErrorMessage(error));
        return false;
      }
    },
    [walletAddress, chainId, ensureMatchingNetwork, getWriteContract, runContractTx, feed, setStatus]
  );

  return {
    burnPost,
    freezePost,
    handleAction,
    handleTip,
    withdrawTips
  };
}
