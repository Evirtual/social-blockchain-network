import type { ProfileCardProps, WalletCardProps } from "@features/app";
import { Feed } from "@features/feed";
import type { Post } from "@types";
import { FeedHeaderControls } from "@features/feed";
import { useAccountPageViewModel } from "../hooks/useAccountPageViewModel";
import { AccountSidebar } from "../components/AccountSidebar";
import type { PostActionsController } from "@features/post";

type Props = {
  isOwner: boolean;
  sidebar: ProfileCardProps & WalletCardProps;

  status: string;
  isFeedLoading: boolean;

  posts: Post[];
  savedPosts: Post[];
  likedPosts: Post[];
  isLoadingSaved: boolean;
  isLoadingLiked: boolean;
  chainId: string | null;
  walletAddress: string | null;
  authorIdentity: Map<string, { name: string; hue: number; avatarUrl?: string }>;

  postActions: PostActionsController;

  shortAddress: (address: string) => string;
  stableHueFromSeed: (seed: string) => number;
  getNativeSymbol: (chainId: string | null) => string;
  getExplorerTxUrl: (chainId: string | null, txHash: string) => string | null;
};

export function AccountPage(props: Props) {
  const {
    displayActivePosts,
    isDisplayLoading,
    headerInlineAction,
    pillText,
    searchQuery,
    setSearchQuery,
    submitSearch,
    isSearchDirty,
    restoreDraftToApplied,
    selectedNetworkChainIds,
    setSelectedNetworkChainIds,
    supportedNetworks,
    isPillLoading,
    isSearchLoading
  } = useAccountPageViewModel({
    posts: props.posts,
    savedPosts: props.savedPosts,
    likedPosts: props.likedPosts,
    isFeedLoading: props.isFeedLoading,
    isLoadingSaved: props.isLoadingSaved,
    isLoadingLiked: props.isLoadingLiked,
    chainId: props.chainId,
    walletAddress: props.walletAddress,
    authorIdentity: props.authorIdentity,
    shortAddress: props.shortAddress
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
    <main className="profileLayout">
      <section className="profileTop">
        <AccountSidebar {...props.sidebar} />
      </section>

      <section className="content">
        <Feed
          title="Your posts"
          pillText=""
          headerInlineAction={headerInlineAction}
          headerAction={headerAction}
          isLoading={isDisplayLoading}
          posts={displayActivePosts}
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
    </main>
  );
}
