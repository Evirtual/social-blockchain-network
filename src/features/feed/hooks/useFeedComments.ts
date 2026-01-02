import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Post, PostComment } from "@types";
import { getSocialContract } from "@features/contract";
import { setStatusFromError, type ErrorInput } from "@shared/lib/errors";
import { queryLogsPaged, withTimeout } from "@shared/lib/feedQuery";
import { runInFlight } from "@shared/lib/inFlight";
import { commentKey } from "./utils";
import { getCommentsReadContext } from "./comments/getCommentsReadContext";
import { computeCommentsFromBlock, findMintBlockHint } from "./comments/computeCommentsFromBlock";
import { parseCommentLogs } from "./comments/parseCommentLogs";
import type { ChainProvider, ReadContractFactory, SocialPostsContract } from "@features/contract";

type ContractLike = {
  ensureContractDeployedOnCurrentNetwork: () => Promise<void>;
  getReadContract: ReadContractFactory;
};

type PostsRefLike = { current: Post[] };

export function useFeedComments(params: {
  provider: ChainProvider | null;
  chainId: string | null;
  contract: ContractLike;
  setStatus: (s: string) => void;
  postsRef: PostsRefLike;
}) {
  const { provider, chainId, contract, setStatus, postsRef } = params;

  const [postComments, setPostComments] = useState<Record<string, PostComment[]>>({});
  const [isLoadingPostComments, setIsLoadingPostComments] = useState<Record<string, boolean>>({});

  const commentsInFlightRef = useRef<Record<string, Promise<void> | null>>({});

  const lastChainIdRef = useRef<string | null | undefined>(undefined);
  const lastProviderRef = useRef<ChainProvider | null | undefined>(undefined);

  useEffect(() => {
    const chainChanged = lastChainIdRef.current !== chainId;
    const providerChanged = lastProviderRef.current !== provider;
    if (!chainChanged && !providerChanged) return;

    lastChainIdRef.current = chainId;
    lastProviderRef.current = provider;

    setPostComments({});
    setIsLoadingPostComments({});
    commentsInFlightRef.current = {};
  }, [chainId, provider]);

  const loadCommentsForPost = useCallback(
    async (tokenId: string, postChainId?: string | null) => {
      const tokenIdBig = BigInt(tokenId);

      const readCtx = await getCommentsReadContext({ provider, chainId, postChainId, contract });
      if (!readCtx.canRead) return;

      // NOTE: keep this to preserve prior behavior even if it isn't used by all paths.
      // (Some bundlers/tree-shakers can be sensitive to unused imports in certain configs.)
      void getSocialContract;

      const key = commentKey(readCtx.keyChainId, tokenId);
      const readProvider: ChainProvider = readCtx.readProvider;
      const readContract: SocialPostsContract = readCtx.readContract;

      await runInFlight(commentsInFlightRef.current, key, async () => {
        setIsLoadingPostComments((prev) => ({ ...prev, [key]: true }));
        try {
          const latest = await withTimeout(readProvider.getBlockNumber(), 6_000, "comments getBlockNumber");
          if (!Number.isFinite(latest) || latest < 0) {
            setPostComments((prev) => ({ ...prev, [key]: [] }));
            return;
          }

          const mintHint = findMintBlockHint(postsRef.current, tokenId, postChainId);
          const fromBlock = computeCommentsFromBlock({
            latestBlock: latest,
            cachedLastScannedBlock: null,
            mintHintBlockNumber: mintHint
          });
          if (fromBlock > latest) return;

          const filters = [
            { filter: readContract.filters.CommentAdded(null, tokenIdBig, null), label: "comment-added" },
            { filter: readContract.filters.CommentEdited(null, tokenIdBig, null), label: "comment-edited" },
            { filter: readContract.filters.CommentDeleted(null, tokenIdBig, null), label: "comment-deleted" },
            { filter: readContract.filters.CommentLiked(null, tokenIdBig, null), label: "comment-liked" },
            { filter: readContract.filters.CommentUnliked(null, tokenIdBig, null), label: "comment-unliked" },
            { filter: readContract.filters.CommentSaved(null, tokenIdBig, null), label: "comment-saved" },
            { filter: readContract.filters.CommentUnsaved(null, tokenIdBig, null), label: "comment-unsaved" },
            { filter: readContract.filters.CommentTipped(null, null, tokenIdBig, null), label: "comment-tipped" }
          ];

          const logBatches = await Promise.all(
            filters.map(({ filter, label }) =>
              queryLogsPaged({
                readContract,
                filter,
                fromBlock,
                toBlock: latest,
                label: `${label} ${tokenId}`,
                timeoutMs: 8_000,
                initialChunkSize: 50_000,
                minChunkSize: 250
              })
            )
          );

          const parsedNew: PostComment[] = parseCommentLogs(logBatches.flat());
          setPostComments((prev) => ({ ...prev, [key]: parsedNew }));
        } catch (err) {
          setStatusFromError(setStatus, err as ErrorInput);
        } finally {
          setIsLoadingPostComments((prev) => ({ ...prev, [key]: false }));
        }
      });
    },
    [provider, chainId, contract, postsRef, setStatus]
  );

  return useMemo(
    () => ({
      postComments,
      setPostComments,
      isLoadingPostComments,
      loadCommentsForPost
    }),
    [postComments, isLoadingPostComments, loadCommentsForPost]
  );
}
