import { useTipWithRefresh } from "@features/social";
import { useContractState } from "@features/contract";
import { useComposer } from "@features/composer";
import { useFeedState } from "@features/feed";
import { useProfileState } from "@features/profile";
import { useSocialActions } from "@features/social";
import { useWalletState } from "@features/wallet";
import { useStatusState } from "@features/status";
import { getExplorerTxUrl, getNativeSymbol } from "@shared/lib/chain";
import { shortAddress, stableHueFromSeed } from "@shared/lib/format";
import { HomePage } from "./HomePage";

export function HomePageContainer() {
  const wallet = useWalletState();
  const contract = useContractState();
  const feed = useFeedState();
  const profile = useProfileState();
  const composer = useComposer();
  const social = useSocialActions();
  const { status } = useStatusState();
  const onTip = useTipWithRefresh();

  return (
    <HomePage
      isOwner={contract.isOwner}
      selfAvatarHue={profile.selfAvatarHue}
      ipfsConfigured={composer.ipfsConfigured}
      onOpenComposer={composer.openComposer}
      draft={composer.draft}
      isImageLoading={composer.isImageLoading}
      onDraftFieldChange={composer.handleDraftChange}
      onImageUrlChange={composer.onComposerImageUrlChange}
      onSelectFile={composer.onSelectComposerFile}
      onClearImage={composer.onComposerClearImage}
      onPost={composer.mintPost}
      posts={feed.posts}
      chainId={wallet.chainId}
      networkName={wallet.networkName}
      contractAddress={contract.contractAddress}
      contractDeployed={contract.contractDeployed}
      status={status}
      isFeedLoading={feed.isFeedLoading}
      walletAddress={wallet.walletAddress}
      authorIdentity={profile.authorIdentity}
      editingTokenId={social.editingTokenId}
      editDraft={social.editDraft}
      isEditImageLoading={social.isEditImageLoading}
      onSetEditDraft={social.setEditDraft}
      onStartEditPost={social.startEditPost}
      onCancelEditPost={social.cancelEditPost}
      onSaveEditedPost={social.saveEditedPost}
      onEditSelectFile={social.onEditSelectFile}
      onEditClearImage={social.onEditClearImage}
      onAction={social.handleAction}
      onTip={onTip}
      onBurn={social.burnPost}
      onFreezePost={social.freezePost}
      shortAddress={shortAddress}
      stableHueFromSeed={stableHueFromSeed}
      getNativeSymbol={getNativeSymbol}
      getExplorerTxUrl={getExplorerTxUrl}
    />
  );
}
