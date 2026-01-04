import type { Post } from "@types";
import { Feed, FeedHeaderControls } from "@features/feed";
import { useFeedFilterViewModel } from "@features/feed/viewModel";
import { getFeedStorageKeys } from "@features/feed";
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
    submitSearch,
    isSearchDirty,
    restoreDraftToApplied,
    selectedNetworkChainIds,
    setSelectedNetworkChainIds,
    displayPosts,
    pillText,
    isPillLoading,
    isSearchLoading,
    isDisplayLoading
  } = useFeedFilterViewModel({
    posts: activePosts,
    authorIdentity: props.authorIdentity,
    shortAddress: props.shortAddress,
    ...getFeedStorageKeys({ kind: "profile", address: props.authorAddress }),
    walletAddress: props.walletAddress,
    chainId: props.chainId,
    isFeedLoading: props.isFeedLoading,
    useSubgraphSearch: true,
    authorAddress: props.authorAddress
  });

  const headerAction = (
    <FeedHeaderControls
      pillText={pillText}
      isPillLoading={isPillLoading}
      isSearchLoading={isSearchLoading}
      isSearchDirty={isSearchDirty}
      searchQuery={searchQuery}
      onSearchQueryChange={setSearchQuery}
      onRestoreDraftToApplied={restoreDraftToApplied}
      onSearchSubmit={submitSearch}
      selectedNetworkChainIds={selectedNetworkChainIds}
      onSelectedNetworkChainIdsChange={setSelectedNetworkChainIds}
      supportedNetworks={supportedNetworks}
    />
  );

  return (
    <section className="content">
      <Feed
        title={activeTitle}
        pillText=""
        headerAction={headerAction}
        isLoading={isDisplayLoading}
        loadingText={props.status}
        posts={displayPosts}
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
