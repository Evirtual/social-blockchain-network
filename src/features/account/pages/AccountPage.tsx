import type { ProfileCardProps } from "../../app/components/sidebar/ProfileCard";
import type { WalletCardProps } from "../../app/components/sidebar/WalletCard";
import { Feed } from "../../feed/components/Feed";
import type { Post } from "@types";
import { FeedTopbarControls } from "../../feed/components/FeedTopbarControls";
import { useAccountPageViewModel } from "../hooks/useAccountPageViewModel";
import { AccountSidebar } from "../components/AccountSidebar";
import type { PostActionsController } from "../../post/types";
import { useTopbarCenter } from "../../app/hooks/useTopbarCenter";
import { useMemo } from "react";

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
  });

  const topbarCenter = useMemo(
    () => (
      <FeedTopbarControls
        inlineSlot={headerInlineAction ?? null}
        pillText={pillText}
        isPillLoading={isPillLoading}
        isSearchLoading={isSearchLoading}
        isSearchDirty={isSearchDirty}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        onRestoreDraftToApplied={restoreDraftToApplied}
        onSearchSubmit={submitSearch}
        walletAddress={props.walletAddress}
        chainId={props.chainId}
        selectedNetworkChainIds={selectedNetworkChainIds}
        onSelectedNetworkChainIdsChange={setSelectedNetworkChainIds}
        supportedNetworks={supportedNetworks}
      />
    ),
    [
      headerInlineAction,
      pillText,
      isPillLoading,
      isSearchLoading,
      isSearchDirty,
      searchQuery,
      setSearchQuery,
      restoreDraftToApplied,
      submitSearch,
      props.walletAddress,
      props.chainId,
      selectedNetworkChainIds,
      setSelectedNetworkChainIds,
      supportedNetworks
    ]
  );

  useTopbarCenter(topbarCenter);

  return (
    <main className="profileLayout">
      <section className="profileTop">
        <AccountSidebar {...props.sidebar} />
      </section>

      <section className="content">
        <Feed
          title="Your posts"
          pillText=""
          hideHeader
          isLoading={isDisplayLoading}
          posts={displayActivePosts}
          isOwner={props.isOwner}
          chainId={props.chainId}
          walletAddress={props.walletAddress}
          authorIdentity={props.authorIdentity}
          postActions={props.postActions}
        />
      </section>
    </main>
  );
}
