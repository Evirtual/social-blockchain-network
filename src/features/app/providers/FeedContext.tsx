import { createContext, useContext, useMemo } from "react";
import type { Post, PostComment } from "@types";
import { useContract } from "./ContractContext";
import { useStatus } from "./StatusContext";
import { useWallet } from "./WalletContext";
import { useFeedComments, useFeedRefresh, usePostsByTokenIds } from "../../feed";

export type FeedContextValue = {
  posts: Post[];
  setPosts: React.Dispatch<React.SetStateAction<Post[]>>;

  isFeedLoading: boolean;
  refreshFeed: (accountOverride?: string | null) => Promise<void>;

  postComments: Record<string, PostComment[]>;
  setPostComments: React.Dispatch<React.SetStateAction<Record<string, PostComment[]>>>;
  isLoadingPostComments: Record<string, boolean>;
  loadCommentsForPost: (tokenId: string, postChainId?: string | null) => Promise<void>;

  loadPostsByTokenIds: (tokenIds: string[], postChainId?: string | null) => Promise<void>;
};

const FeedContext: ReturnType<typeof createContext<FeedContextValue | null>> =
  ((globalThis as any).__sbnetFeedContext as ReturnType<typeof createContext<FeedContextValue | null>> | undefined) ??
  (((globalThis as any).__sbnetFeedContext = createContext<FeedContextValue | null>(null)) as ReturnType<
    typeof createContext<FeedContextValue | null>
  >);

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
    [feedRefresh, comments, postsByTokenIds]
  );

  return <FeedContext.Provider value={value}>{children}</FeedContext.Provider>;
}

export function useFeed() {
  const ctx = useContext(FeedContext);
  if (!ctx) throw new Error("useFeed must be used within <FeedProvider>");
  return ctx;
}
