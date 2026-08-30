import { usePostActionsController } from "@features/post/actions";
import { useContractState } from "@features/contract";
import { useComposer } from "@features/composer";
import { useFeedQueries } from "@features/feed";
import { useProfileState } from "@features/profile";
import { useWalletState } from "@features/wallet";
import { useStatusState } from "@features/status";
import { getExplorerTxUrl, getNativeSymbol } from "@shared/lib/network";
import { shortAddress, stableHueFromSeed } from "@shared/lib/formatters";
import { HomePage } from "./HomePage";
import { buildHomePageViewModel } from "../viewModel/buildHomePageViewModel";

export function HomePageContainer() {
  const wallet = useWalletState();
  const contract = useContractState();
  const feed = useFeedQueries();
  const profile = useProfileState();
  const composer = useComposer();
  const { status } = useStatusState();
  const postActions = usePostActionsController();

  const viewModel = buildHomePageViewModel({
    isOwner: contract.isOwner,
    selfAvatarHue: profile.selfAvatarHue,
    ipfsConfigured: composer.ipfsConfigured,
    onOpenComposer: composer.openComposer,
    draft: composer.draft,
    isImageLoading: composer.isImageLoading,
    onDraftFieldChange: composer.handleDraftChange,
    onSelectFile: composer.onSelectComposerFile,
    onClearImage: composer.onComposerClearImage,
    onPost: composer.mintPost,
    posts: feed.posts,
    chainId: wallet.chainId,
    networkName: wallet.networkName,
    contractAddress: contract.contractAddress,
    contractDeployed: contract.contractDeployed,
    status,
    isFeedLoading: feed.isFeedLoading,
    walletAddress: wallet.walletAddress,
    authorIdentity: profile.authorIdentity,
    postActions,
    shortAddress,
    stableHueFromSeed,
    getNativeSymbol,
    getExplorerTxUrl
  });

  return <HomePage {...viewModel} />;
}
