import { HomePage } from "../pages/HomePage";
import { useApp } from "../contexts/AppContext";

export function HomeRoute() {
  const app = useApp();

  return (
    <HomePage
      isOwner={app.isOwner}
      selfAvatarHue={app.selfAvatarHue}
      ipfsConfigured={app.ipfsConfigured}
      onOpenComposer={app.openComposer}
      draft={app.draft}
      isImageLoading={app.isImageLoading}
      onDraftFieldChange={app.handleDraftChange}
      onImageUrlChange={app.onComposerImageUrlChange}
      onSelectFile={app.onSelectComposerFile}
      onClearImage={app.onComposerClearImage}
      onPost={app.mintPost}
      posts={app.posts}
      chainId={app.chainId}
      networkName={app.networkName}
      contractAddress={app.contractAddress}
      contractDeployed={app.contractDeployed}
      status={app.status}
      isFeedLoading={app.isFeedLoading}
      walletAddress={app.walletAddress}
      authorIdentity={app.authorIdentity}
      editingTokenId={app.editingTokenId}
      editDraft={app.editDraft}
      isEditImageLoading={app.isEditImageLoading}
      tipDrafts={app.tipDrafts}
      commentDrafts={app.commentDrafts}
      onSetEditDraft={app.setEditDraft}
      onTipDraftChange={app.onTipDraftChange}
      onCommentDraftChange={app.onCommentDraftChange}
      onStartEditPost={app.startEditPost}
      onCancelEditPost={app.cancelEditPost}
      onSaveEditedPost={app.saveEditedPost}
      onEditSelectFile={app.onEditSelectFile}
      onEditClearImage={app.onEditClearImage}
      onAction={app.handleAction}
      onTip={app.handleTip}
      onBurn={app.burnPost}
      onFreezePost={app.freezePost}
      shortAddress={app.shortAddress}
      stableHueFromSeed={app.stableHueFromSeed}
      getNativeSymbol={app.getNativeSymbol}
      getExplorerTxUrl={app.getExplorerTxUrl}
    />
  );
}
