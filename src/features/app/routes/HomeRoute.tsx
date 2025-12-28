import { HomePage } from "../../home";
import { useComposer, useContract, useFeed, useProfile, useSocialActions, useStatus, useWallet } from "../index";
import { getExplorerTxUrl, getNativeSymbol } from "@shared/lib/chain";
import { shortAddress, stableHueFromSeed } from "@shared/lib/format";
import { useCallback } from "react";

export function HomeRoute() {
  const wallet = useWallet();
  const contract = useContract();
  const feed = useFeed();
  const profile = useProfile();
  const composer = useComposer();
  const social = useSocialActions();
  const { status } = useStatus();

  const onTip = useCallback(
    async (tokenId: string, amountRaw: string, postChainId?: string | null) => {
      const ok = await social.handleTip(tokenId, amountRaw, postChainId);
      if (!ok) return false;
      try {
        await contract.refreshContractState();
      } catch {
        // ignore
      }
      return true;
    },
    [social, contract]
  );

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
