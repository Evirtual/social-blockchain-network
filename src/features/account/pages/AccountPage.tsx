import type { ComponentProps } from "react";
import { ProfileCard, WalletCard, type Sidebar } from "../../app";
import { Feed } from "../../feed";
import type { Draft, Post } from "@types";
import { useEffect, useMemo } from "react";
import { AccountFeedHeaderAction } from "../components/AccountFeedHeaderAction";
import { useAccountFeedView } from "../hooks/useAccountFeedView";
import { FeedHeaderControls } from "../../home/components/FeedHeaderControls";
import { getSupportedNetworks } from "../../home/services/supportedNetworks";
import { filterPosts } from "../../home/services/filterPosts";
import { useSessionStorageState } from "@shared/hooks/useSessionStorageState";

type Props = {
  isOwner: boolean;
  sidebar: ComponentProps<typeof Sidebar>;

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
  const { view, setView, activePosts, activeLoading } = useAccountFeedView({
    posts: props.posts,
    savedPosts: props.savedPosts,
    likedPosts: props.likedPosts,
    isFeedLoading: props.isFeedLoading,
    isLoadingSaved: props.isLoadingSaved,
    isLoadingLiked: props.isLoadingLiked
  });

  const [searchQuery, setSearchQuery] = useSessionStorageState<string>(
    "socialBlockchainNetwork.account.searchQuery",
    "",
    {
      serialize: (v) => String(v ?? ""),
      parse: (raw) => String(raw ?? "")
    }
  );

  const [selectedNetworkChainIds, setSelectedNetworkChainIds, hasStoredSelectedNetworks] = useSessionStorageState<
    string[]
  >(
    "socialBlockchainNetwork.feed.selectedNetworks",
    [],
    {
      serialize: (v) => JSON.stringify({ ids: v }),
      parse: (raw) => {
        try {
          const parsed = JSON.parse(raw) as any;
          const ids = Array.isArray(parsed?.ids)
            ? parsed.ids.filter((x: unknown) => typeof x === "string" && x.trim()).map((x: string) => x.trim())
            : [];
          return ids;
        } catch {
          return [];
        }
      }
    }
  );

  const supportedNetworks = useMemo(() => getSupportedNetworks(), []);

  const selectedNetworkSet = useMemo(() => new Set(selectedNetworkChainIds.map(String)), [selectedNetworkChainIds]);

  const filterBySelectedNetworks = useMemo(() => {
    return (posts: Post[]) => {
      if (selectedNetworkSet.size === 0) return posts;
      return posts.filter((post) => {
        const id = post.chainId ?? null;
        if (!id) return false;
        return selectedNetworkSet.has(String(id));
      });
    };
  }, [selectedNetworkSet]);

  const postedCount = useMemo(() => filterBySelectedNetworks(props.posts).length, [props.posts, filterBySelectedNetworks]);
  const savedCount = useMemo(
    () => filterBySelectedNetworks(props.savedPosts).length,
    [props.savedPosts, filterBySelectedNetworks]
  );
  const likedCount = useMemo(
    () => filterBySelectedNetworks(props.likedPosts).length,
    [props.likedPosts, filterBySelectedNetworks]
  );

  useEffect(() => {
    if (hasStoredSelectedNetworks) return;
    if (!props.walletAddress) return;
    const currentChainId = props.chainId ? String(props.chainId) : null;
    if (!currentChainId) return;
    const supported = new Set(supportedNetworks.map((n) => String(n.chainId)));
    if (!supported.has(currentChainId)) return;
    setSelectedNetworkChainIds([currentChainId]);
  }, [
    hasStoredSelectedNetworks,
    props.walletAddress,
    props.chainId,
    supportedNetworks,
    setSelectedNetworkChainIds
  ]);

  const filteredActivePosts = useMemo(() => {
    return filterPosts({
      posts: activePosts,
      authorIdentity: props.authorIdentity,
      shortAddress: props.shortAddress,
      searchQuery,
      selectedNetworkChainIds
    });
  }, [activePosts, props.authorIdentity, props.shortAddress, searchQuery, selectedNetworkChainIds]);
  const activeTitle = "Your posts";
  const activePill = "";

  const headerInlineAction = useMemo(() => {
    return (
      <AccountFeedHeaderAction
        view={view}
        onViewChange={setView}
        postedCount={postedCount}
        savedCount={savedCount}
        likedCount={likedCount}
      />
    );
  }, [view, setView, postedCount, savedCount, likedCount]);

  const hasAnyFilter = !!searchQuery.trim() || selectedNetworkChainIds.length > 0;
  const pillText = hasAnyFilter
    ? `${filteredActivePosts.length} / ${activePosts.length} posts`
    : `${activePosts.length} posts`;

  return (
    <main className="profileLayout">
      <section className="profileTop">
        <ProfileCard
          walletAddress={props.sidebar.walletAddress}
          displayName={props.sidebar.displayName}
          profileBio={props.sidebar.profileBio}
          profileAvatarUrl={props.sidebar.profileAvatarUrl}
          myPostsCount={props.sidebar.myPostsCount}
          isLoadingMyPostsCount={props.sidebar.isLoadingMyPostsCount}
          followerCount={props.sidebar.followerCount}
          followers={props.sidebar.followers}
          following={props.sidebar.following}
          isLoadingFollowers={props.sidebar.isLoadingFollowers}
          isLoadingFollowing={props.sidebar.isLoadingFollowing}
          onDisconnectWallet={props.sidebar.onDisconnectWallet}
          isEditingProfile={props.sidebar.isEditingProfile}
          profileDraftName={props.sidebar.profileDraftName}
          profileDraftBio={props.sidebar.profileDraftBio}
          profileDraftAvatarUrl={props.sidebar.profileDraftAvatarUrl}
          profileDraftAvatarDataUrl={props.sidebar.profileDraftAvatarDataUrl}
          isProfileAvatarLoading={props.sidebar.isProfileAvatarLoading}
          onProfileDraftNameChange={props.sidebar.onProfileDraftNameChange}
          onProfileDraftBioChange={props.sidebar.onProfileDraftBioChange}
          onProfileDraftAvatarUrlChange={props.sidebar.onProfileDraftAvatarUrlChange}
          onSelectProfileAvatarFile={props.sidebar.onSelectProfileAvatarFile}
          onClearProfileAvatar={props.sidebar.onClearProfileAvatar}
          onStartEditProfile={props.sidebar.onStartEditProfile}
          onCancelEditProfile={props.sidebar.onCancelEditProfile}
          onSaveProfile={props.sidebar.onSaveProfile}
          selfAvatarHue={props.sidebar.selfAvatarHue}
          shortAddress={props.sidebar.shortAddress}
        />

        <WalletCard
          walletAddress={props.sidebar.walletAddress}
          chainId={props.sidebar.chainId}
          networkName={props.sidebar.networkName}
          nativeBalance={props.sidebar.nativeBalance}
          withdrawableTipsWei={props.sidebar.withdrawableTipsWei}
          contractAddress={props.sidebar.contractAddress}
          contractDeployed={props.sidebar.contractDeployed}
          status={props.sidebar.status}
          onWithdrawTips={props.sidebar.onWithdrawTips}
          shortAddress={props.sidebar.shortAddress}
          getNativeSymbol={props.sidebar.getNativeSymbol}
        />
      </section>

      <section className="content">
        <Feed
          title={activeTitle}
          pillText={activePill}
          headerInlineAction={headerInlineAction}
          headerAction={
            <FeedHeaderControls
              pillText={pillText}
              searchQuery={searchQuery}
              onSearchQueryChange={setSearchQuery}
              selectedNetworkChainIds={selectedNetworkChainIds}
              onSelectedNetworkChainIdsChange={setSelectedNetworkChainIds}
              supportedNetworks={supportedNetworks}
            />
          }
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
