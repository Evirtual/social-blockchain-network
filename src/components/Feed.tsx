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
  isOwner?: boolean;
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

  onAction: (tokenId: string, action: "like" | "comment" | "save", postChainId?: string | null) => void;
  onTip: (tokenId: string, postChainId?: string | null) => void;
  onBurn: (tokenId: string, postChainId?: string | null) => void;
  onFreezePost: (tokenId: string, postChainId?: string | null) => void;

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
  posts,
  isOwner,
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
  onFreezePost,
  shortAddress,
  stableHueFromSeed,
  getNativeSymbol,
  getExplorerTxUrl
}: Props) {
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? `${location.pathname}${location.search}`;
  const { getPanel, togglePanel } = usePanelById<PostPanel>();

  const showSkeletons = !!isLoading;
  const initialSkeletonCount = 4;
  const trailingSkeletonCount = 1;
  const skeletonCount = posts.length === 0 ? initialSkeletonCount : trailingSkeletonCount;

  return (
    <section className="feed">
      {hideHeader ? null : (
        <div className="feed-header">
          <h2 className="feedHeaderTitle">{title ?? "Chain Feed"}</h2>
          {headerAction ? <div className="feedHeaderAction">{headerAction}</div> : null}
          {pillText === "" ? null : (
            <span className="pill feedHeaderPill">{pillText ?? `${posts.length} minted posts`}</span>
          )}
        </div>
      )}

      <div
        className={singleColumn ? "posts postsSingle" : "posts"}
        aria-busy={isLoading ? true : undefined}
        aria-label={isLoading ? "Loading posts" : undefined}
        role={isLoading && posts.length === 0 ? "status" : undefined}
      >
        {posts.map((post, index) => {
          const authorKey = post.author?.toLowerCase();
          const info = authorKey ? authorIdentity.get(authorKey) : undefined;
          const authorLabel = (info?.name?.trim() || (post.author ? shortAddress(post.author) : "Unknown")) as string;
          const authorHue = info?.hue ?? stableHueFromSeed("guest");
          const authorAvatarUrl = info?.avatarUrl;
          const isMine = !!walletAddress && !!post.author && walletAddress.toLowerCase() === post.author.toLowerCase();
          const canModerate = !!isOwner;
          const panelKey = `${post.chainId ?? ""}:${post.tokenId}`;
          const openPanel = getPanel(panelKey);
          const compositeKey = `${panelKey}:${post.contextTag ?? "post"}:${index}`;

          return (
            <PostCard
              key={compositeKey}
              post={post}
              animationDelayMs={index * 80}
              from={from}
              chainId={chainId}
              walletAddress={walletAddress}
              authorLabel={authorLabel}
              authorHue={authorHue}
              authorAvatarUrl={authorAvatarUrl}
              isMine={isMine}
              canModerate={canModerate}
              editingTokenId={editingTokenId}
              editDraft={editDraft}
              isEditImageLoading={isEditImageLoading}
              tipDrafts={tipDrafts}
              commentDrafts={commentDrafts}
              openPanel={openPanel}
              onTogglePanel={(panel) => togglePanel(panelKey, panel)}
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
              onFreezePost={onFreezePost}
              getNativeSymbol={getNativeSymbol}
              getExplorerTxUrl={getExplorerTxUrl}
            />
          );
        })}

        {showSkeletons
          ? Array.from({ length: skeletonCount }).map((_, index) => (
              <article key={`skeleton-${index}`} className="post postSkeleton" aria-hidden="true">
                <div className="postHead">
                  <div className="avatar small skeleton" />
                  <div className="postHeadMain">
                    <div className="postHeadTop">
                      <div className="skeletonLine" style={{ width: "40%" }} />
                      <div className="skeletonLine" style={{ width: "22%" }} />
                    </div>
                  </div>
                </div>

                <div className="post-body">
                  <div className="skeletonLine" style={{ width: "92%" }} />
                  <div className="skeletonLine" style={{ width: "84%" }} />
                  <div className="skeletonLine" style={{ width: "66%" }} />
                </div>
              </article>
            ))
          : null}
      </div>
    </section>
  );
}
