import { usePostActionsController } from "@features/post/actions";
import { useContractState } from "../../contract/providers/useContractState";
import { useComposer } from "../../composer/providers/useComposer";
import { useFeedQueries } from "../../feed/providers/useFeedQueries";
import { useProfileState } from "../../profile/providers/useProfileState";
import { useWalletState } from "../../wallet/providers/useWalletState";
import { useStatusState } from "../../status/providers/StatusProvider";
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
  });

  return <HomePage {...viewModel} />;
}
