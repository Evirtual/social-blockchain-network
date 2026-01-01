import type { ProfileCardProps, WalletCardProps } from "@features/app";
import { Feed } from "@features/feed";
import type { Post } from "@types";
import { FeedHeaderControls } from "@features/home/components/FeedHeaderControls";
import { useAccountPageViewModel } from "../hooks/useAccountPageViewModel";
import { AccountSidebar } from "../components/AccountSidebar";
import { useMemo } from "react";
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
    activeLoading,
    filteredActivePosts,
    headerInlineAction,
    pillText,
    searchQuery,
    setSearchQuery,
    selectedNetworkChainIds,
    setSelectedNetworkChainIds,
    supportedNetworks,
    isPillLoading
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
          isLoading={activeLoading}
          posts={filteredActivePosts}
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
