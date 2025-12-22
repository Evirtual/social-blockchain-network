import type { ComponentProps } from "react";
import { ProfileCard, WalletCard, type Sidebar } from "../components/Sidebar";
import { Feed } from "../components/Feed";
import type { Draft, Post } from "../types";

type Props = {
  sidebar: ComponentProps<typeof Sidebar>;

  status: string;
  isFeedLoading: boolean;

  posts: Post[];
  chainId: string | null;
  walletAddress: string | null;
  authorIdentity: Map<string, { name: string; hue: number; avatarUrl?: string }>;

  editingTokenId: string | null;
  editDraft: Draft;
  isEditImageLoading: boolean;
  tipDrafts: Record<string, string>;
  commentDrafts: Record<string, string>;

  onSetEditDraft: (next: Draft) => void;
  onTipDraftChange: (tokenId: string, value: string) => void;
  onCommentDraftChange: (tokenId: string, value: string) => void;

  onStartEditPost: (post: Post) => void;
  onCancelEditPost: () => void;
  onSaveEditedPost: () => void;
  onEditSelectFile: (file: File | null) => void;
  onEditClearImage: () => void;

  onAction: (tokenId: string, action: "like" | "comment") => void;
  onTip: (tokenId: string) => void;
  onBurn: (tokenId: string) => void;

  shortAddress: (address: string) => string;
  stableHueFromSeed: (seed: string) => number;
  getNativeSymbol: (chainId: string | null) => string;
  getExplorerTxUrl: (chainId: string | null, txHash: string) => string | null;
};

export function AccountPage(props: Props) {
  return (
    <main className="profileLayout">
      <section className="profileTop">
        <ProfileCard
          walletAddress={props.sidebar.walletAddress}
          displayName={props.sidebar.displayName}
          profileBio={props.sidebar.profileBio}
          profileAvatarUrl={props.sidebar.profileAvatarUrl}
          myPostsCount={props.sidebar.myPostsCount}
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
          onRefreshWalletPanel={props.sidebar.onRefreshWalletPanel}
          onWithdrawTips={props.sidebar.onWithdrawTips}
          shortAddress={props.sidebar.shortAddress}
          getNativeSymbol={props.sidebar.getNativeSymbol}
        />
      </section>

      <section className="content">
        <Feed
          title="Your Posts"
          pillText={`${props.posts.length} posts`}
          isLoading={props.isFeedLoading}
          loadingText={props.status}
          posts={props.posts}
          chainId={props.chainId}
          walletAddress={props.walletAddress}
          authorIdentity={props.authorIdentity}
          editingTokenId={props.editingTokenId}
          editDraft={props.editDraft}
          isEditImageLoading={props.isEditImageLoading}
          tipDrafts={props.tipDrafts}
          commentDrafts={props.commentDrafts}
          onSetEditDraft={props.onSetEditDraft}
          onTipDraftChange={props.onTipDraftChange}
          onCommentDraftChange={props.onCommentDraftChange}
          onStartEditPost={props.onStartEditPost}
          onCancelEditPost={props.onCancelEditPost}
          onSaveEditedPost={props.onSaveEditedPost}
          onEditSelectFile={props.onEditSelectFile}
          onEditClearImage={props.onEditClearImage}
          onAction={props.onAction}
          onTip={props.onTip}
          onBurn={props.onBurn}
          shortAddress={props.shortAddress}
          stableHueFromSeed={props.stableHueFromSeed}
          getNativeSymbol={props.getNativeSymbol}
          getExplorerTxUrl={props.getExplorerTxUrl}
        />
      </section>
    </main>
  );
}
