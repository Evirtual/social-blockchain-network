import type { Draft, Post } from "@types";
import { Feed } from "../../feed";
import { useCallback, useMemo, useState } from "react";
import { FeedHeaderControls } from "../components/FeedHeaderControls";
import { HomeHeroIntro } from "../components/HomeHeroIntro";
import { HomeHeroSupportedNetworks } from "../components/HomeHeroSupportedNetworks";
import { getSupportedNetworks } from "../services/supportedNetworks";
import { usePersistedFlag } from "../hooks/usePersistedFlag";
import { filterPosts } from "../services/filterPosts";
import { usePinCurrentNetworkFilter } from "../hooks/usePinCurrentNetworkFilter";

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

  editingTokenId: string | null;
  editDraft: Draft;
  isEditImageLoading: boolean;

  onSetEditDraft: (next: Draft) => void;

  onStartEditPost: (post: Post) => void;
  onCancelEditPost: () => void;
  onSaveEditedPost: () => Promise<void>;
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

export function HomePage(props: Props) {
  const [isHeroDismissed, setIsHeroDismissed] = usePersistedFlag("socialBlockchainNetwork.heroDismissed");

  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedNetworkChainIds, setSelectedNetworkChainIds] = useState<string[]>([]);

  const [isSupportedNetworksDismissed, setIsSupportedNetworksDismissed] = usePersistedFlag(
    "socialBlockchainNetwork.supportedNetworksDismissed"
  );

  const supportedNetworks = useMemo(() => getSupportedNetworks(), []);

  usePinCurrentNetworkFilter({
    walletAddress: props.walletAddress,
    chainId: props.chainId,
    supportedNetworks,
    setSelectedNetworkChainIds
  });

  const requestWalletNetworkSwitch = useCallback(
    async (targetChainId: number) => {
      const eth = window.ethereum as
        | {
            request?: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
          }
        | undefined;
      if (!eth?.request) return;
      if (props.chainId && props.chainId === String(targetChainId)) return;

      try {
        await eth.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: `0x${targetChainId.toString(16)}` }]
        });
      } catch {
        // Ignore (user rejection, wallet missing chain, etc.)
      }
    },
    [props.chainId]
  );

  const canSwitchNetwork = useMemo(() => {
    const eth = window.ethereum as
      | {
          request?: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
        }
      | undefined;
    return !!eth?.request;
  }, []);

  const filteredPosts = useMemo(() => {
    return filterPosts({
      posts: props.posts,
      authorIdentity: props.authorIdentity,
      shortAddress: props.shortAddress,
      searchQuery,
      selectedNetworkChainIds
    });
  }, [props.posts, props.authorIdentity, props.shortAddress, searchQuery, selectedNetworkChainIds]);

  const hasAnyFilter = !!searchQuery.trim() || selectedNetworkChainIds.length > 0;
  const pillText = hasAnyFilter ? `${filteredPosts.length} / ${props.posts.length} posts` : `${props.posts.length} posts`;

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
        pillText={pillText}
        headerAction={
          <FeedHeaderControls
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            selectedNetworkChainIds={selectedNetworkChainIds}
            onSelectedNetworkChainIdsChange={setSelectedNetworkChainIds}
            supportedNetworks={supportedNetworks}
          />
        }
        isLoading={props.isFeedLoading}
        posts={filteredPosts}
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
    </main>
  );
}
