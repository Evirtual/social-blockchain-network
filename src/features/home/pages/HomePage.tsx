import type { Draft, Post } from "@types";
import { Feed } from "../../feed/components/Feed";
import { FeedTopbarControls } from "../../feed/components/FeedTopbarControls";
import { useFeedFilterViewModel } from "@features/feed/viewModel";
import { useCallback, useMemo } from "react";
import type { PostActionsController } from "../../post/types";
import { getFeedStorageKeys } from "../../feed/lib/feedStorageKeys";
import { HomeHeroIntro } from "../components/HomeHeroIntro";
import { HomeHeroSupportedNetworks } from "../components/HomeHeroSupportedNetworks";
import { usePersistedFlag } from "../hooks/usePersistedFlag";
import { requestNetworkSwitch } from "@shared/lib/networkSwitch";
import { useTopbarCenter } from "../../app/hooks/useTopbarCenter";
import { getAddEthereumChainParameter } from "../../feed/services/supportedNetworks";

type Props = {
  isOwner: boolean;
  selfAvatarHue: number;
  ipfsConfigured: boolean;
  onOpenComposer: () => void;
  draft: Draft;
  isImageLoading: boolean;
  onDraftFieldChange: (field: keyof Draft, value: string) => void;
  onSelectFile: (file: File | null) => void;
  onClearImage: () => void;
  onPost: () => void;

  posts: Post[];
  chainId: string | null;
  networkName?: string | null;
  contractAddress?: string;
  contractDeployed?: boolean | null;
  status: string;
  isFeedLoading: boolean;
  walletAddress: string | null;
  authorIdentity: Map<string, { name: string; hue: number; avatarUrl?: string }>;

  postActions: PostActionsController;

};

export function HomePage(props: Props) {
  const [isHeroDismissed, setIsHeroDismissed] = usePersistedFlag("socialBlockchainNetwork.heroDismissed");

  const {
    supportedNetworks,
    searchQuery,
    setSearchQuery,
    submitSearch,
    isSearchDirty,
    restoreDraftToApplied,
    selectedNetworkChainIds,
    setSelectedNetworkChainIds,
    displayPosts,
    pillText,
    isPillLoading,
    isSearchLoading,
    isDisplayLoading
  } = useFeedFilterViewModel({
    posts: props.posts,
    authorIdentity: props.authorIdentity,
    ...getFeedStorageKeys({ kind: "home" }),
    walletAddress: props.walletAddress,
    chainId: props.chainId,
    isFeedLoading: props.isFeedLoading,
    useSubgraphSearch: true,
    countMode: "visible"
  });

  const [isSupportedNetworksDismissed, setIsSupportedNetworksDismissed] = usePersistedFlag(
    "socialBlockchainNetwork.supportedNetworksDismissed"
  );

  const requestWalletNetworkSwitch = useCallback(
    async (targetChainId: number) => {
      const network = supportedNetworks.find((n) => n.chainId === targetChainId);
      await requestNetworkSwitch(targetChainId, props.chainId, network ? getAddEthereumChainParameter(network) : null);
    },
    [props.chainId, supportedNetworks]
  );

  const canSwitchNetwork = useMemo(() => {
    const eth = window.ethereum as { request?: unknown } | undefined;
    return !!eth?.request;
  }, []);

  const isDisconnected = !props.walletAddress;
  const currentChainId = String(props.chainId ?? "").trim();
  const isUnsupportedWalletNetwork =
    !!props.walletAddress && (!currentChainId || !supportedNetworks.some((n) => String(n.chainId) === currentChainId));
  const isWrongNetwork =
    isUnsupportedWalletNetwork ||
    (!!props.walletAddress && (props.contractAddress == null || props.contractDeployed === false));
  const showNetworkCard = !isSupportedNetworksDismissed || isWrongNetwork;

  const showIntroHero = !isHeroDismissed;
  const heroCount = (showIntroHero ? 1 : 0) + (showNetworkCard ? 1 : 0);

  const currentNetworkLabel = useMemo(() => {
    if (!props.walletAddress) return "";
    if (props.networkName && props.networkName.trim()) return props.networkName;
    if (props.chainId) return `chainId ${props.chainId}`;
    return "";
  }, [props.walletAddress, props.networkName, props.chainId]);

  const topbarCenter = useMemo(
    () => (
      <FeedTopbarControls
        pillText={pillText}
        isPillLoading={isPillLoading}
        isSearchLoading={isSearchLoading}
        isSearchDirty={isSearchDirty}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        onRestoreDraftToApplied={restoreDraftToApplied}
        onSearchSubmit={submitSearch}
        walletAddress={props.walletAddress}
        chainId={props.chainId}
        selectedNetworkChainIds={selectedNetworkChainIds}
        onSelectedNetworkChainIdsChange={setSelectedNetworkChainIds}
        supportedNetworks={supportedNetworks}
      />
    ),
    [
      pillText,
      isPillLoading,
      isSearchLoading,
      isSearchDirty,
      searchQuery,
      setSearchQuery,
      restoreDraftToApplied,
      submitSearch,
      props.walletAddress,
      props.chainId,
      selectedNetworkChainIds,
      setSelectedNetworkChainIds,
      supportedNetworks
    ]
  );

  useTopbarCenter(topbarCenter);

  return (
    <main className="home">
      {showIntroHero || showNetworkCard ? (
        <div className={heroCount === 1 ? "homeHeroRow homeHeroRowSingle" : "homeHeroRow"}>
          {showIntroHero ? (
            <HomeHeroIntro onDismiss={() => setIsHeroDismissed(true)} />
          ) : null}

          {showNetworkCard ? (
            <HomeHeroSupportedNetworks
              isDisconnected={isDisconnected}
              isWrongNetwork={isWrongNetwork}
              currentNetworkLabel={currentNetworkLabel}
              supportedNetworks={supportedNetworks}
              canSwitchNetwork={canSwitchNetwork}
              currentChainId={props.chainId}
              onDismiss={() => setIsSupportedNetworksDismissed(true)}
              onRequestWalletNetworkSwitch={requestWalletNetworkSwitch}
            />
          ) : null}
        </div>
      ) : null}

      <Feed
        title="Main Feed"
        pillText=""
        hideHeader
        isLoading={isDisplayLoading}
        posts={displayPosts}
        isOwner={props.isOwner}
        chainId={props.chainId}
        walletAddress={props.walletAddress}
        authorIdentity={props.authorIdentity}
        postActions={props.postActions}
      />
    </main>
  );
}
