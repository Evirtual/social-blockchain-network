import { usePostActionsController } from "@features/post";
import { useContractState } from "@features/contract";
import { useComposer } from "@features/composer";
import { useFeedState } from "@features/feed";
import { useProfileState } from "@features/profile";
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
  const { status } = useStatusState();
  const postActions = usePostActionsController();

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
      postActions={postActions}
      shortAddress={shortAddress}
      stableHueFromSeed={stableHueFromSeed}
      getNativeSymbol={getNativeSymbol}
      getExplorerTxUrl={getExplorerTxUrl}
    />
  );
}
