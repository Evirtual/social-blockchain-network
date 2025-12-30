import { useMemo } from "react";
import { useFeedComments } from "../hooks/useFeedComments";
import { useFeedRefresh } from "../hooks/useFeedRefresh";
import { usePostsByTokenIds } from "../hooks/usePostsByTokenIds";
import { useContractActions } from "@features/contract";
import { useStatusActions } from "@features/status";
import { useWalletState } from "@features/wallet";
import {
  FeedActionsContext,
  FeedContext,
  FeedStateContext,
  type FeedActions,
  type FeedContextValue,
  type FeedState
} from "./feedStateContext";

export type { FeedContextValue } from "./feedStateContext";

export function FeedProvider({ children }: { children: React.ReactNode }) {
  const { provider, walletAddress, chainId, walletEpoch } = useWalletState();
  const { setStatus } = useStatusActions();
  const contract = useContractActions();

  const contractApi = useMemo(
    () => ({
      ensureContractDeployedOnCurrentNetwork: contract.ensureContractDeployedOnCurrentNetwork,
      getReadContract: contract.getReadContract
    }),
    [contract.ensureContractDeployedOnCurrentNetwork, contract.getReadContract]
  );

  const feedRefresh = useFeedRefresh({
    wallet: { provider, walletAddress, chainId, walletEpoch },
    contract: contractApi,
    setStatus
  });

  const comments = useFeedComments({
    provider,
    chainId,
    contract: contractApi,
    setStatus,
    postsRef: feedRefresh.postsRef
  });

  const postsByTokenIds = usePostsByTokenIds({
    provider,
    chainId,
    walletAddress,
    contract: contractApi,
    postsRef: feedRefresh.postsRef,
    setPosts: feedRefresh.setPosts
  });

  const stateValue = useMemo<FeedState>(
    () => ({
      posts: feedRefresh.posts,
      isFeedLoading: feedRefresh.isFeedLoading,
      postComments: comments.postComments,
      isLoadingPostComments: comments.isLoadingPostComments
    }),
    [feedRefresh.posts, feedRefresh.isFeedLoading, comments.postComments, comments.isLoadingPostComments]
  );

  const actionsValue = useMemo<FeedActions>(
    () => ({
      setPosts: feedRefresh.setPosts,
      refreshFeed: feedRefresh.refreshFeed,
      setPostComments: comments.setPostComments,
      loadCommentsForPost: comments.loadCommentsForPost,
      loadPostsByTokenIds: postsByTokenIds.loadPostsByTokenIds
    }),
    [
      feedRefresh.setPosts,
      feedRefresh.refreshFeed,
      comments.setPostComments,
      comments.loadCommentsForPost,
      postsByTokenIds.loadPostsByTokenIds
    ]
  );

  const value = useMemo<FeedContextValue>(() => ({ ...stateValue, ...actionsValue }), [stateValue, actionsValue]);

  return (
    <FeedStateContext.Provider value={stateValue}>
      <FeedActionsContext.Provider value={actionsValue}>
        <FeedContext.Provider value={value}>{children}</FeedContext.Provider>
      </FeedActionsContext.Provider>
    </FeedStateContext.Provider>
  );
}
