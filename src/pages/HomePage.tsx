import type { Draft, Post } from "../types";
import { Feed } from "../components/Feed";
import { useMemo, useState } from "react";
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

  onAction: (tokenId: string, action: "like" | "comment" | "share") => void;
  onTip: (tokenId: string) => void;
  onBurn: (tokenId: string) => void;
  onFreezePost: (tokenId: string) => void;

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
  // UX requirement: show only mainnets (no chainId display), as pills with logo + name.
  return [
    { chainId: 8453, name: "Base", description: "" },
    { chainId: 1, name: "Ethereum", description: "" },
    { chainId: 56, name: "BSC", description: "" }
  ];
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

  const [isSupportedNetworksDismissed, setIsSupportedNetworksDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem("socialBlockchainNetwork.supportedNetworksDismissed") === "1";
    } catch {
      return false;
    }
  });

  const filteredPosts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return props.posts;

    return props.posts.filter((post) => {
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
  }, [props.posts, props.authorIdentity, props.shortAddress, searchQuery]);

  const pillText = searchQuery.trim()
    ? `${filteredPosts.length} / ${props.posts.length} posts`
    : `${props.posts.length} posts`;

  const supportedNetworks = useMemo(() => getSupportedNetworks(), []);

  const isDisconnected = !props.walletAddress;
  const isWrongNetwork =
    !!props.walletAddress && (props.contractAddress == null || props.contractDeployed === false);
  const showNetworkCard = (isDisconnected || isWrongNetwork) && !isSupportedNetworksDismissed;

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
                  ? "Connect your wallet on the supported mainnet to post, react, and tip."
                  : "Your wallet is connected, but this app isn’t configured for the current network."}
              </div>
              {isWrongNetwork && currentNetworkLabel ? (
                <div className="pill">Current: {currentNetworkLabel}</div>
              ) : null}

              <div className="heroBullets" role="list">
                {supportedNetworks.map((n) => (
                  <div key={n.chainId} className="pill" role="listitem" aria-label={n.name}>
                    <span className="pillIcon" aria-hidden="true">
                      <ChainLogo chainId={n.chainId} size={16} />
                    </span>
                    {n.name}
                  </div>
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
          <input
            className="input feedSearch"
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search posts or accounts"
            aria-label="Search posts or accounts"
          />
        }
        isLoading={props.isFeedLoading}
        loadingText={props.status}
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
