import { useCallback, useMemo, useRef, useState } from "react";
import type { Post, PostComment } from "@types";
import { getSocialContract } from "../../contract";
import { getErrorMessage } from "@shared/lib/errors";
import { queryLogsPaged, withTimeout } from "@shared/lib/feedQuery";
import { runInFlight } from "@shared/lib/inFlight";
import { commentKey } from "./utils";
import { getCommentsReadContext } from "./comments/getCommentsReadContext";
import { computeCommentsFromBlock, findMintBlockHint } from "./comments/computeCommentsFromBlock";
import { parseCommentLogs } from "./comments/parseCommentLogs";
import { mergeComments } from "./comments/mergeComments";

type ContractLike = {
  ensureContractDeployedOnCurrentNetwork: () => Promise<void>;
  getReadContract: () => Promise<any>;
};

type PostsRefLike = { current: Post[] };

export function useFeedComments(params: {
  provider: any;
  chainId: string | null;
  contract: ContractLike;
  setStatus: (s: string) => void;
  postsRef: PostsRefLike;
}) {
  const { provider, chainId, contract, setStatus, postsRef } = params;

  const [postComments, setPostComments] = useState<Record<string, PostComment[]>>({});
  const [isLoadingPostComments, setIsLoadingPostComments] = useState<Record<string, boolean>>({});

  const commentsInFlightRef = useRef<Record<string, Promise<void> | null>>({});
  const commentsCacheRef = useRef<Map<string, { lastScannedBlock: number; comments: PostComment[] }>>(new Map());

  const loadCommentsForPost = useCallback(
    async (tokenId: string, postChainId?: string | null) => {
      const tokenIdBig = BigInt(tokenId);

      const readCtx = await getCommentsReadContext({ provider, chainId, postChainId, contract });
      if (!readCtx.canRead) return;

      // NOTE: keep this to preserve prior behavior even if it isn't used by all paths.
      // (Some bundlers/tree-shakers can be sensitive to unused imports in certain configs.)
      void getSocialContract;

      const key = commentKey(readCtx.keyChainId, tokenId);
      const readProvider: any = readCtx.readProvider;
      const readContract: any = readCtx.readContract;

      await runInFlight(commentsInFlightRef.current, key, async () => {
        setIsLoadingPostComments((prev) => ({ ...prev, [key]: true }));
        try {
          const latestAny = await withTimeout<any>(readProvider.getBlockNumber(), 6_000, "comments getBlockNumber");
          const latest = Number(latestAny);
          if (!Number.isFinite(latest) || latest < 0) {
            setPostComments((prev) => ({ ...prev, [key]: [] }));
            return;
          }

          const cached = commentsCacheRef.current.get(key);

          const mintHint = findMintBlockHint(postsRef.current, tokenId, postChainId);
          const fromBlock = computeCommentsFromBlock({
            latestBlock: latest,
            cachedLastScannedBlock: cached ? cached.lastScannedBlock : null,
            mintHintBlockNumber: mintHint
          });
          if (fromBlock > latest) {
            if (cached) {
              setPostComments((prev) => (prev[key] === cached.comments ? prev : { ...prev, [key]: cached.comments }));
            }
            return;
          }

          const filter = readContract.filters.PostCommented(null, tokenIdBig);
          const logs = await queryLogsPaged({
            readContract,
            filter,
            fromBlock,
            toBlock: latest,
            label: `comments ${tokenId}`,
            timeoutMs: 8_000,
            initialChunkSize: 50_000,
            minChunkSize: 250
          });

          const parsedNew: PostComment[] = parseCommentLogs(logs);
          const merged = mergeComments(cached?.comments ?? [], parsedNew);

          commentsCacheRef.current.set(key, { lastScannedBlock: latest, comments: merged });
          setPostComments((prev) => ({ ...prev, [key]: merged }));
        } catch (err) {
          setStatus(getErrorMessage(err));
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
