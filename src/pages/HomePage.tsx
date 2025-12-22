import type { Draft, Post } from "../types";
import { Feed } from "../components/Feed";
import { useState } from "react";

type Props = {
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

  onAction: (tokenId: string, action: "like" | "comment") => void;
  onTip: (tokenId: string) => void;
  onBurn: (tokenId: string) => void;

  shortAddress: (address: string) => string;
  stableHueFromSeed: (seed: string) => number;
  getNativeSymbol: (chainId: string | null) => string;
  getExplorerTxUrl: (chainId: string | null, txHash: string) => string | null;
};

export function HomePage(props: Props) {
  const [isHeroDismissed, setIsHeroDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem("socialBlockchainNetwork.heroDismissed") === "1";
    } catch {
      return false;
    }
  });

  return (
    <main className="home">
      {!isHeroDismissed && (
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
      )}

      <Feed
        title="Main Feed"
        pillText={`${props.posts.length} posts`}
        headerAction={
          <button className="primary iconButton" type="button" onClick={props.onOpenComposer} aria-label="Create post">
            +
          </button>
        }
        posts={props.posts}
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
        shortAddress={props.shortAddress}
        stableHueFromSeed={props.stableHueFromSeed}
        getNativeSymbol={props.getNativeSymbol}
        getExplorerTxUrl={props.getExplorerTxUrl}
      />
    </main>
  );
}
