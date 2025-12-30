import type { ProfileCardProps, WalletCardProps } from "@features/app";
import { Feed } from "@features/feed";
import type { Draft, Post } from "@types";
import { FeedHeaderControls } from "@features/home/components/FeedHeaderControls";
import { useAccountPageViewModel } from "../hooks/useAccountPageViewModel";
import { AccountSidebar } from "../components/AccountSidebar";
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

  editingTokenId: string | null;
  editDraft: Draft;
  isEditImageLoading: boolean;

  onSetEditDraft: (next: Draft) => void;

  onStartEditPost: (post: Post) => void;
  onCancelEditPost: () => void;
  onSaveEditedPost: () => Promise<void>;
  onEditSelectFile: (file: File | null) => void;
  onEditClearImage: () => void;

  onAction: (
    tokenId: string,
    action: "like" | "comment" | "save",
    postChainId?: string | null,
    comment?: string
  ) => Promise<boolean>;
  onTip: (tokenId: string, amountRaw: string, postChainId?: string | null) => Promise<boolean>;
  onBurn: (tokenId: string, postChainId?: string | null) => void;
  onFreezePost: (tokenId: string, postChainId?: string | null) => void;

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
    supportedNetworks
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
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        selectedNetworkChainIds={selectedNetworkChainIds}
        onSelectedNetworkChainIdsChange={setSelectedNetworkChainIds}
        supportedNetworks={supportedNetworks}
      />
    );
  }, [pillText, searchQuery, setSearchQuery, selectedNetworkChainIds, setSelectedNetworkChainIds, supportedNetworks]);

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
          editingTokenId={props.editingTokenId}
          editDraft={props.editDraft}
          isEditImageLoading={props.isEditImageLoading}
          onSetEditDraft={props.onSetEditDraft}
          onStartEditPost={props.onStartEditPost}
          onCancelEditPost={props.onCancelEditPost}
          onSaveEditedPost={props.onSaveEditedPost}
          onEditSelectFile={props.onEditSelectFile}
          onEditClearImage={props.onEditClearImage}
          onAction={props.onAction}
          onTip={props.onTip}
          onBurn={props.onBurn}
          onFreezePost={props.onFreezePost}
          shortAddress={props.shortAddress}
          stableHueFromSeed={props.stableHueFromSeed}
          getNativeSymbol={props.getNativeSymbol}
          getExplorerTxUrl={props.getExplorerTxUrl}
        />
      </section>
    </main>
  );
}
