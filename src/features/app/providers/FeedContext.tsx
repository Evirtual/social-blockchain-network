import { useMemo } from "react";
import { useContract } from "./ContractContext";
import { useStatus } from "./StatusContext";
import { useWallet } from "./WalletContext";
import { useFeedComments, useFeedRefresh, usePostsByTokenIds } from "../../feed";
import { FeedContext, type FeedContextValue } from "./feedStateContext";

export type { FeedContextValue } from "./feedStateContext";

export function FeedProvider({ children }: { children: React.ReactNode }) {
  const { provider, walletAddress, chainId, walletEpoch } = useWallet();
  const { setStatus } = useStatus();
  const contract = useContract();

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

  const value = useMemo<FeedContextValue>(
    () => ({
      posts: feedRefresh.posts,
      setPosts: feedRefresh.setPosts,
      isFeedLoading: feedRefresh.isFeedLoading,
      refreshFeed: feedRefresh.refreshFeed,
      postComments: comments.postComments,
      setPostComments: comments.setPostComments,
      isLoadingPostComments: comments.isLoadingPostComments,
      loadCommentsForPost: comments.loadCommentsForPost,
      loadPostsByTokenIds: postsByTokenIds.loadPostsByTokenIds
    }),
    [
      feedRefresh.posts,
      feedRefresh.setPosts,
      feedRefresh.isFeedLoading,
      feedRefresh.refreshFeed,
      comments.postComments,
      comments.setPostComments,
      comments.isLoadingPostComments,
      comments.loadCommentsForPost,
      postsByTokenIds.loadPostsByTokenIds
    ]
  );

  return <FeedContext.Provider value={value}>{children}</FeedContext.Provider>;
}


