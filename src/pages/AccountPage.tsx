import type { ComponentProps } from "react";
import { ProfileCard, WalletCard, type Sidebar } from "../components/Sidebar";
import { Feed } from "../components/Feed";
import type { Draft, Post } from "../types";
import { useMemo, useState } from "react";

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
  onSaveEditedPost: () => void;
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
  const [view, setView] = useState<"all" | "saved" | "liked">("all");

  const activePosts = useMemo(() => {
    if (view === "saved") return props.savedPosts.map((p) => ({ ...p, contextTag: "saved" as const }));
    if (view === "liked") return props.likedPosts.map((p) => ({ ...p, contextTag: "liked" as const }));
    return props.posts.map((p) => ({ ...p, contextTag: undefined }));
  }, [view, props.posts, props.savedPosts, props.likedPosts]);
  const activeLoading = view === "saved" ? props.isLoadingSaved : view === "liked" ? props.isLoadingLiked : props.isFeedLoading;
  const activeTitle = "Your posts";
  const activePill = "";

  const headerAction = useMemo(() => {
    return (
      <div className="row" style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
        <button className={view === "all" ? "btn secondary" : "btn ghost"} type="button" onClick={() => setView("all")}>
          Posted ({props.posts.length})
        </button>
        <button
          className={view === "saved" ? "btn secondary" : "btn ghost"}
          type="button"
          onClick={() => setView("saved")}
        >
          Saved ({props.savedPosts.length})
        </button>
        <button
          className={view === "liked" ? "btn secondary" : "btn ghost"}
          type="button"
          onClick={() => setView("liked")}
        >
          Liked ({props.likedPosts.length})
        </button>
      </div>
    );
  }, [view, props.posts.length, props.savedPosts.length, props.likedPosts.length]);

  return (
    <main className="profileLayout">
      <section className="profileTop">
        <ProfileCard
          walletAddress={props.sidebar.walletAddress}
          displayName={props.sidebar.displayName}
          profileBio={props.sidebar.profileBio}
          profileAvatarUrl={props.sidebar.profileAvatarUrl}
          myPostsCount={props.sidebar.myPostsCount}
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
          headerAction={headerAction}
          isLoading={activeLoading}
          posts={activePosts}
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
