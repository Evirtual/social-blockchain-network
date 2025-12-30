import { useCallback } from "react";

import { getErrorMessage } from "@shared/lib/errors";
import { collectIpfsCidsFromTokenUri } from "@features/ipfs";
import { requestConnectNudge } from "@shared/lib/connectNudge";
import { isSamePost } from "../services/postActions/matchPost";
import { postKeyFromParts } from "@shared/lib/post";

import type { Post, PostComment } from "@types";

type FeedLike = {
  posts: Post[];
  setPosts: React.Dispatch<React.SetStateAction<Post[]>>;
  refreshFeed: () => Promise<void>;
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

export function usePostModeration(args: {
  walletAddress: string | null;
  chainId: string | null;
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
        const post = feed.posts.find((p) => isSamePost({ post: p, tokenId, postChainId }));
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

        const editKey = editingTokenId ? postKeyFromParts(postChainId ?? null, tokenId) : null;
        if (editingTokenId && editKey === editingTokenId) {
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

  return {
    burnPost,
    freezePost
  };
}
