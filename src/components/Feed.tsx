import type { ReactNode } from "react";
import type { Draft, Post } from "../types";
import { useLocation } from "react-router-dom";
import { PostCard, type PostPanel } from "./PostCard";
import { usePanelById } from "../hooks/usePanelById";

type Props = {
  title?: string;
  pillText?: string;
  headerAction?: ReactNode;
  singleColumn?: boolean;
  hideHeader?: boolean;
  isLoading?: boolean;
  loadingText?: string;
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

export function Feed({
  title,
  pillText,
  headerAction,
  singleColumn,
  hideHeader,
  isLoading,
  loadingText,
  posts,
  chainId,
  walletAddress,
  authorIdentity,
  editingTokenId,
  editDraft,
  isEditImageLoading,
  tipDrafts,
  commentDrafts,
  onSetEditDraft,
  onTipDraftChange,
  onCommentDraftChange,
  onStartEditPost,
  onCancelEditPost,
  onSaveEditedPost,
  onEditSelectFile,
  onEditClearImage,
  onAction,
  onTip,
  onBurn,
  shortAddress,
  stableHueFromSeed,
  getNativeSymbol,
  getExplorerTxUrl
}: Props) {
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? `${location.pathname}${location.search}`;
  const { getPanel, togglePanel } = usePanelById<PostPanel>();

  return (
    <section className="feed">
      {hideHeader ? null : (
        <div className="feed-header">
          <h2 className="feedHeaderTitle">{title ?? "Chain Feed"}</h2>
          {headerAction ? <div className="feedHeaderAction">{headerAction}</div> : null}
          <span className="pill feedHeaderPill">{pillText ?? `${posts.length} minted posts`}</span>
        </div>
      )}

      {isLoading ? (
        <section className="card">
          <div className="cardTitle">Loading posts…</div>
          <div className="muted">{loadingText || "Fetching on-chain posts. This can take a few seconds on testnets."}</div>
        </section>
      ) : null}

      <div className={singleColumn ? "posts postsSingle" : "posts"}>
        {posts.map((post, index) => {
          const authorKey = post.author?.toLowerCase();
          const info = authorKey ? authorIdentity.get(authorKey) : undefined;
          const authorLabel = (info?.name?.trim() || (post.author ? shortAddress(post.author) : "Unknown")) as string;
          const authorHue = info?.hue ?? stableHueFromSeed("guest");
          const authorAvatarUrl = info?.avatarUrl;
          const isMine = !!walletAddress && !!post.author && walletAddress.toLowerCase() === post.author.toLowerCase();
          const openPanel = getPanel(post.tokenId);

          return (
            <PostCard
              key={post.tokenId}
              post={post}
              animationDelayMs={index * 80}
              from={from}
              chainId={chainId}
              walletAddress={walletAddress}
              authorLabel={authorLabel}
              authorHue={authorHue}
              authorAvatarUrl={authorAvatarUrl}
              isMine={isMine}
              editingTokenId={editingTokenId}
              editDraft={editDraft}
              isEditImageLoading={isEditImageLoading}
              tipDrafts={tipDrafts}
              commentDrafts={commentDrafts}
              openPanel={openPanel}
              onTogglePanel={(panel) => togglePanel(post.tokenId, panel)}
              onSetEditDraft={onSetEditDraft}
              onTipDraftChange={onTipDraftChange}
              onCommentDraftChange={onCommentDraftChange}
              onStartEditPost={onStartEditPost}
              onCancelEditPost={onCancelEditPost}
              onSaveEditedPost={onSaveEditedPost}
              onEditSelectFile={onEditSelectFile}
              onEditClearImage={onEditClearImage}
              onAction={onAction}
              onTip={onTip}
              onBurn={onBurn}
              getNativeSymbol={getNativeSymbol}
              getExplorerTxUrl={getExplorerTxUrl}
            />
          );
        })}
      </div>
    </section>
  );
}
