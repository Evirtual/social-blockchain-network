import type { Draft, Post } from "@types";
import { Feed, FeedHeaderControls } from "@features/feed";
import { useFeedFilterViewModel } from "@features/feed/viewModel";
import { useCallback, useMemo } from "react";
import type { PostActionsController } from "@features/post";
import { HomeHeroIntro } from "../components/HomeHeroIntro";
import { HomeHeroSupportedNetworks } from "../components/HomeHeroSupportedNetworks";
import { usePersistedFlag } from "../hooks/usePersistedFlag";
import { requestNetworkSwitch } from "@shared/lib/networkSwitch";

type Props = {
  isOwner: boolean;
  selfAvatarHue: number;
  ipfsConfigured: boolean;
  onOpenComposer: () => void;
  draft: Draft;
  isImageLoading: boolean;
  onDraftFieldChange: (field: keyof Draft, value: string) => void;
  onImageUrlChange: (value: string) => void;
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

  shortAddress: (address: string) => string;
  stableHueFromSeed: (seed: string) => number;
  getNativeSymbol: (chainId: string | null) => string;
  getExplorerTxUrl: (chainId: string | null, txHash: string) => string | null;
};

export function HomePage(props: Props) {
  const [isHeroDismissed, setIsHeroDismissed] = usePersistedFlag("socialBlockchainNetwork.heroDismissed");

  const {
    supportedNetworks,
    searchQuery,
    setSearchQuery,
    selectedNetworkChainIds,
    setSelectedNetworkChainIds,
    filteredPosts,
    pillText,
    isPillLoading
  } = useFeedFilterViewModel({
    posts: props.posts,
    authorIdentity: props.authorIdentity,
    shortAddress: props.shortAddress,
    searchQueryKey: "socialBlockchainNetwork.feed.searchQuery",
    selectedNetworksKey: "socialBlockchainNetwork.feed.selectedNetworks",
    walletAddress: props.walletAddress,
    chainId: props.chainId,
    isFeedLoading: props.isFeedLoading,
    useSubgraphSearch: true
  });

  const [isSupportedNetworksDismissed, setIsSupportedNetworksDismissed] = usePersistedFlag(
    "socialBlockchainNetwork.supportedNetworksDismissed"
  );

  const requestWalletNetworkSwitch = useCallback(
    async (targetChainId: number) => {
      await requestNetworkSwitch(targetChainId, props.chainId);
    },
    [props.chainId]
  );

  const canSwitchNetwork = useMemo(() => {
    const eth = window.ethereum as { request?: unknown } | undefined;
    return !!eth?.request;
  }, []);

  const isDisconnected = !props.walletAddress;
  const isWrongNetwork =
    !!props.walletAddress && (props.contractAddress == null || props.contractDeployed === false);
  const showNetworkCard = !isSupportedNetworksDismissed;

  const showIntroHero = !isHeroDismissed;
  const heroCount = (showIntroHero ? 1 : 0) + (showNetworkCard ? 1 : 0);

  const currentNetworkLabel = useMemo(() => {
    if (!props.walletAddress) return "";
    if (props.networkName && props.networkName.trim()) return props.networkName;
    if (props.chainId) return `chainId ${props.chainId}`;
    return "";
  }, [props.walletAddress, props.networkName, props.chainId]);

  const headerAction = useMemo(() => {
    return (
      <FeedHeaderControls
        pillText={pillText}
        isPillLoading={isPillLoading}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        selectedNetworkChainIds={selectedNetworkChainIds}
        onSelectedNetworkChainIdsChange={setSelectedNetworkChainIds}
        supportedNetworks={supportedNetworks}
      />
    );
  }, [
    pillText,
    isPillLoading,
    searchQuery,
    setSearchQuery,
    selectedNetworkChainIds,
    setSelectedNetworkChainIds,
    supportedNetworks
  ]);

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
        headerAction={headerAction}
        isLoading={props.isFeedLoading}
        posts={filteredPosts}
        isOwner={props.isOwner}
        chainId={props.chainId}
        walletAddress={props.walletAddress}
        authorIdentity={props.authorIdentity}
        postActions={props.postActions}
        shortAddress={props.shortAddress}
        stableHueFromSeed={props.stableHueFromSeed}
        getNativeSymbol={props.getNativeSymbol}
        getExplorerTxUrl={props.getExplorerTxUrl}
      />
    </main>
  );
}
