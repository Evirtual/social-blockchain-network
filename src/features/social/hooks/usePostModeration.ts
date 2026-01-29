import { useCallback } from "react";

import { collectIpfsCidsFromTokenUri, extractIpfsCid } from "@features/ipfs";
import { isSamePost } from "../services/postActions/matchPost";
import { postKeyFromParts } from "@features/post/services";
import { runSocialAction } from "../services/actions/runSocialAction";
import { markPostBurned } from "@shared/lib/burnedPostsCache";

import type { Post, PostComment } from "@types";
import type { TransactionResponse } from "ethers";
import type { ReadContractFactory, WriteContractFactory } from "@features/contract";

type FeedLike = {
  posts: Post[];
  setPosts: React.Dispatch<React.SetStateAction<Post[]>>;
  refreshFeed: () => Promise<void>;
  setPostComments: React.Dispatch<React.SetStateAction<Record<string, PostComment[]>>>;
};

type RunContractTxLike = <T = void>(
  label: string,
  send: () => Promise<TransactionResponse>,
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
  getReadContract: ReadContractFactory;
  getWriteContract: WriteContractFactory;
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
      await runSocialAction<void>({
        walletAddress,
        setStatus,
        ensureMatchingNetwork,
        postChainId,
        action: async () => {
          const writeContract = await getWriteContract();
          const ok = await runContractTx<boolean>(
            "Freeze post",
            () => writeContract.freezePost(BigInt(tokenId)),
            () => true
          );
          if (!ok) return;

          cancelEditPost();
          setStatus("Post frozen. Editing is now disabled for this token.");
        }
      });
    },
    [walletAddress, ensureMatchingNetwork, getWriteContract, runContractTx, cancelEditPost, setStatus]
  );

  const burnPost = useCallback(
    async (tokenId: string, postChainId?: string | null) => {
      await runSocialAction<void>({
        walletAddress,
        setStatus,
        ensureMatchingNetwork,
        postChainId,
        action: async () => {
          const activeWallet = walletAddress;
          if (!activeWallet) return;

          const post = feed.posts.find((p) => isSamePost({ post: p, tokenId, postChainId }));

          // Capture tokenURI + related IPFS CIDs before burn.
          let pinnedCids: Set<string> | null = null;
          if (ipfsConfigured) {
            const cids = new Set<string>();

            // Prefer capturing from the cached feed entry first (covers cases where the on-chain
            // metadata is missing the video poster/thumbnail reference, or metadata fetch fails).
            const cachedRefs = [post?.metadataURI, post?.image, post?.animationUrl].filter(
              (x): x is string => typeof x === "string" && x.trim().length > 0
            );
            for (const ref of cachedRefs) {
              const cid = extractIpfsCid(ref);
              if (cid) cids.add(cid);
            }

            try {
              const readContract = await getReadContract();
              const tokenIdBig = BigInt(tokenId);
              const oldTokenUri = (await readContract.tokenURI(tokenIdBig)) as string;
              const tokenUriCids = await collectIpfsCidsFromTokenUri(oldTokenUri);
              for (const cid of tokenUriCids) cids.add(cid);
            } catch {
              // Best-effort only; still attempt to unpin any cached refs.
            }

            pinnedCids = cids.size > 0 ? cids : null;
          }

          const writeContract = await getWriteContract();
          const tokenIdBig = BigInt(tokenId);
          const author = post?.author;
          const isMine = !!author && activeWallet.toLowerCase() === author.toLowerCase();
          const send =
            isOwner && !isMine
              ? () => writeContract.adminBurnPost(tokenIdBig)
              : () => writeContract.burnPost(tokenIdBig);

          await runContractTx("Burn post", send);

          // Best-effort cleanup: stop pinning the burned post's metadata/media.
          if (ipfsConfigured && pinnedCids) {
            void bestEffortUnpinCidsSafe(pinnedCids, { chainId: postChainId ?? chainId, tokenIds: [tokenId] });
          }

          markPostBurned(postChainId ?? chainId, tokenId);

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
        }
      });
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
