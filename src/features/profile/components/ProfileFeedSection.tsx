import type { Post } from "@types";
import { Feed, FeedHeaderControls } from "@features/feed";
import { useFeedFilterViewModel } from "@features/feed/viewModel";
import type { PostActionsController } from "@features/post";
import { useMemo } from "react";

type Props = {
  posts: Post[];
  authorIdentity: Map<string, { name: string; hue: number; avatarUrl?: string }>;
  shortAddress: (address: string) => string;
  chainId: string | null;
  walletAddress: string | null;
  isFeedLoading: boolean;
  status: string;
  isOwner: boolean;
  postActions: PostActionsController;
  stableHueFromSeed: (seed: string) => number;
  getNativeSymbol: (chainId: string | null) => string;
  getExplorerTxUrl: (chainId: string | null, txHash: string) => string | null;
  authorAddress: string;
};

export function ProfileFeedSection(props: Props) {
  const activePosts = useMemo(() => props.posts.map((p) => ({ ...p, contextTag: undefined })), [props.posts]);
  const activeTitle = "Profile Feed";

  const {
    supportedNetworks,
    searchQuery,
    setSearchQuery,
    selectedNetworkChainIds,
    setSelectedNetworkChainIds,
    filteredPosts,
    pillText,
    isPillLoading
  } = useFeedFilterViewModel({
    posts: activePosts,
    authorIdentity: props.authorIdentity,
    shortAddress: props.shortAddress,
    searchQueryKey: "socialBlockchainNetwork.feed.searchQuery",
    selectedNetworksKey: "socialBlockchainNetwork.feed.selectedNetworks",
    walletAddress: props.walletAddress,
    chainId: props.chainId,
    isFeedLoading: props.isFeedLoading,
    useSubgraphSearch: true,
    authorAddress: props.authorAddress
  });

  const headerAction = useMemo(() => {
    return (
      <FeedHeaderControls
        pillText={pillText}
        isPillLoading={isPillLoading}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        selectedNetworkChainIds={selectedNetworkChainIds}
        onSelectedNetworkChainIdsChange={setSelectedNetworkChainIds}
        supportedNetworks={supportedNetworks}
      />
    );
  }, [
    pillText,
    isPillLoading,
    searchQuery,
    setSearchQuery,
    selectedNetworkChainIds,
    setSelectedNetworkChainIds,
    supportedNetworks
  ]);

  return (
    <section className="content">
      <Feed
        title={activeTitle}
        pillText=""
        headerAction={headerAction}
        isLoading={props.isFeedLoading}
        loadingText={props.status}
        posts={filteredPosts}
        isOwner={props.isOwner}
        chainId={props.chainId}
        walletAddress={props.walletAddress}
        authorIdentity={props.authorIdentity}
        postActions={props.postActions}
        shortAddress={props.shortAddress}
        stableHueFromSeed={props.stableHueFromSeed}
        getNativeSymbol={props.getNativeSymbol}
        getExplorerTxUrl={props.getExplorerTxUrl}
      />
    </section>
  );
}
