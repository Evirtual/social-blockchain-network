import type { Draft, Post } from "../types";
import { Feed } from "../components/Feed";
import { useCallback, useMemo, useState } from "react";
import { ChainLogo } from "../components/ChainLogos";

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

  onAction: (tokenId: string, action: "like" | "comment" | "share", postChainId?: string | null) => void;
  onTip: (tokenId: string, postChainId?: string | null) => void;
  onBurn: (tokenId: string, postChainId?: string | null) => void;
  onFreezePost: (tokenId: string, postChainId?: string | null) => void;

  shortAddress: (address: string) => string;
  stableHueFromSeed: (seed: string) => number;
  getNativeSymbol: (chainId: string | null) => string;
  getExplorerTxUrl: (chainId: string | null, txHash: string) => string | null;
};

type SupportedNetwork = {
  chainId: number;
  name: string;
  description: string;
};

function getSupportedNetworks(): SupportedNetwork[] {
  // UX requirement: show supported networks as pills with logo + name.
  const networks: SupportedNetwork[] = [
    { chainId: 84532, name: "Base testnet", description: "" },
    { chainId: 11155111, name: "Ethereum testnet", description: "" },
    { chainId: 97, name: "BSC testnet", description: "" }
  ];

  const localAddr = (import.meta.env.VITE_CONTRACT_ADDRESS_LOCAL || "").trim();
  if (localAddr) {
    networks.unshift({ chainId: 31337, name: "Local", description: "" });
  }

  return networks;
}

export function HomePage(props: Props) {
  const [isHeroDismissed, setIsHeroDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem("socialBlockchainNetwork.heroDismissed") === "1";
    } catch {
      return false;
    }
  });

  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedNetworkChainIds, setSelectedNetworkChainIds] = useState<string[]>([]);

  const [isSupportedNetworksDismissed, setIsSupportedNetworksDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem("socialBlockchainNetwork.supportedNetworksDismissed") === "1";
    } catch {
      return false;
    }
  });

  const supportedNetworks = useMemo(() => getSupportedNetworks(), []);

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
    const q = searchQuery.trim().toLowerCase();

    const selectedSet = new Set(selectedNetworkChainIds);
    const byNetwork = selectedSet.size
      ? props.posts.filter((post) => {
          const id = post.chainId ?? null;
          if (!id) return false;
          return selectedSet.has(String(id));
        })
      : props.posts;

    if (!q) return byNetwork;

    return byNetwork.filter((post) => {
      const author = post.author ?? "";
      const authorKey = author.toLowerCase();
      const identityName = authorKey ? props.authorIdentity.get(authorKey)?.name ?? "" : "";
      const short = author ? props.shortAddress(author) : "";

      const haystack = [post.tokenId, post.title, post.body, author, identityName, short]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
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
            <section className="card hero">
              <button
                className="iconButton ghost heroClose"
                type="button"
                aria-label="Dismiss intro"
                onClick={() => {
                  setIsHeroDismissed(true);
                  try {
                    localStorage.setItem("socialBlockchainNetwork.heroDismissed", "1");
                  } catch {
                    // ignore write failures (e.g. private browsing)
                  }
                }}
              >
                ×
              </button>

              <div className="heroTitle">A social blockchain network where posts are NFTs</div>
              <div className="heroSub muted">
                Mint posts on-chain. Likes and comments are wallet-signed interactions. Tips go directly to creators.
              </div>
              <div className="heroBullets">
                <div className="pill">On-chain posts</div>
                <div className="pill">Signed reactions</div>
                <div className="pill">Creator tips</div>
                <div className="pill">IPFS media</div>
              </div>
            </section>
          ) : null}

          {showNetworkCard ? (
            <section className="card hero supportedNetworksHero">
              <button
                className="iconButton ghost heroClose"
                type="button"
                aria-label="Dismiss supported networks"
                onClick={() => {
                  setIsSupportedNetworksDismissed(true);
                  try {
                    localStorage.setItem("socialBlockchainNetwork.supportedNetworksDismissed", "1");
                  } catch {
                    // ignore
                  }
                }}
              >
                ×
              </button>

              <div className="heroTitle">Supported networks</div>
              <div className="heroSub muted">
                {isDisconnected
                  ? "Connect your wallet on a supported testnet to post, react, and tip."
                  : isWrongNetwork
                    ? "Your wallet is connected, but this app isn’t configured for the current network."
                    : "Use one of these testnets to post, react, and tip."}
              </div>
              {isWrongNetwork && currentNetworkLabel ? (
                <div className="pill">Current: {currentNetworkLabel}</div>
              ) : null}

              <div className="heroBullets" role="list">
                {supportedNetworks.map((n) => (
                  <button
                    key={n.chainId}
                    className={`pill pillButton ${props.chainId === String(n.chainId) ? "isCurrentNetwork" : ""}`}
                    type="button"
                    role="listitem"
                    aria-label={n.name}
                    aria-current={props.chainId === String(n.chainId) ? "true" : undefined}
                    onClick={() => {
                      void requestWalletNetworkSwitch(n.chainId);
                    }}
                    disabled={!canSwitchNetwork}
                    title={!canSwitchNetwork ? "Connect a wallet to switch networks" : undefined}
                  >
                    <span className="pillIcon" aria-hidden="true">
                      <ChainLogo chainId={n.chainId} size={16} />
                    </span>
                    {n.name}
                  </button>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      ) : null}

      <Feed
        title="Main Feed"
        pillText={pillText}
        headerAction={
          <div className="feedHeaderControls">
            <input
              className="input feedSearch"
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search posts or accounts"
              aria-label="Search posts or accounts"
            />

            <details className="feedNetworkFilter">
              <summary className="input feedNetworkFilterSummary" aria-label="Filter networks">
                Networks {selectedNetworkChainIds.length ? `(${selectedNetworkChainIds.length})` : "(All)"}
              </summary>
              <div className="feedNetworkFilterMenu" role="group" aria-label="Network filters">
                {supportedNetworks.map((n) => {
                  const value = String(n.chainId);
                  const checked = selectedNetworkChainIds.includes(value);
                  return (
                    <label key={value} className="feedNetworkFilterOption">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          setSelectedNetworkChainIds((prev) => {
                            if (e.target.checked) return Array.from(new Set([...prev, value]));
                            return prev.filter((x) => x !== value);
                          });
                        }}
                      />
                      {n.name}
                    </label>
                  );
                })}
              </div>
            </details>
          </div>
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
        onFreezePost={props.onFreezePost}
        shortAddress={props.shortAddress}
        stableHueFromSeed={props.stableHueFromSeed}
        getNativeSymbol={props.getNativeSymbol}
        getExplorerTxUrl={props.getExplorerTxUrl}
      />
    </main>
  );
}
