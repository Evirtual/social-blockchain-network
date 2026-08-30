import { useCallback, useMemo } from "react";
import type { Post } from "@types";
import { mapWithConcurrency } from "@shared/lib/async";
import { postKey } from "./utils";
import { getPostsByTokenIdsReadContext } from "./postsByTokenIds/getReadContext";
import { computeMissingTokenIds } from "./postsByTokenIds/computeMissingTokenIds";
import { fetchPostByTokenId } from "./postsByTokenIds/fetchPostByTokenId";
import { mergePostsByKey } from "./postsByTokenIds/mergePostsByKey";
import type { ChainProvider, ReadContractFactory } from "@features/contract/types";
import type { LoadPostsByTokenIdsResult } from "../providers/feedStateContext";

type ContractLike = {
  ensureContractDeployedOnCurrentNetwork: () => Promise<void>;
  getReadContract: ReadContractFactory;
};

type PostsRefLike = { current: Post[] };

export function usePostsByTokenIds(params: {
  provider: ChainProvider | null;
  chainId: string | null;
  walletAddress: string | null;
  contract: ContractLike;
  postsRef: PostsRefLike;
  setPosts: React.Dispatch<React.SetStateAction<Post[]>>;
}) {
  const { provider, chainId, walletAddress, contract, postsRef, setPosts } = params;

  const loadPostsByTokenIds = useCallback(
    async (tokenIds: string[], postChainId?: string | null) => {
      if (!tokenIds.length) return { didFetch: false, posts: [] } satisfies LoadPostsByTokenIdsResult;

      const readCtx = await getPostsByTokenIdsReadContext({ provider, chainId, postChainId, contract });
      if (!readCtx.canRead) return { didFetch: false, posts: [] } satisfies LoadPostsByTokenIdsResult;

      const missing = computeMissingTokenIds({
        tokenIds,
        currentChainId: readCtx.currentChainId,
        postsSnapshot: postsRef.current
      });
      if (missing.length === 0) return { didFetch: false, posts: [] } satisfies LoadPostsByTokenIdsResult;

      const fetched = await mapWithConcurrency(missing, 6, async (id) => {
        return await fetchPostByTokenId({
          id,
          currentChainId: readCtx.currentChainId,
          readContract: readCtx.readContract,
          walletAddress
        });
      });

      const toAdd = fetched.filter((p): p is Post => p != null);
      if (toAdd.length === 0) return { didFetch: true, posts: [] } satisfies LoadPostsByTokenIdsResult;

      setPosts((prev) => {
        return mergePostsByKey(prev, toAdd, postKey);
      });

      return { didFetch: true, posts: toAdd } satisfies LoadPostsByTokenIdsResult;
    },
    [provider, chainId, walletAddress, contract, postsRef, setPosts]
  );

  return useMemo(() => ({ loadPostsByTokenIds }), [loadPostsByTokenIds]);
}
