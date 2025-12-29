import { memo, type ReactNode } from "react";
import type { Draft, Post } from "@types";
import { useLocation } from "react-router-dom";
import { PostCard, type PostPanel } from "../../post";
import { usePanelById } from "@shared/hooks/usePanelById";
import { getFeedFromLocation } from "./feed/getFeedFromLocation";
import { getSkeletonCount } from "./feed/getSkeletonCount";
import { FeedSkeleton } from "./feed/FeedSkeleton";
import { getAuthorPresentation } from "./feed/getAuthorPresentation";

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

export const Feed = memo(function Feed({
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
  onSetEditDraft,
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
  const from = getFeedFromLocation(location);
  const { getPanel, togglePanel } = usePanelById<PostPanel>();

  const walletLower = walletAddress ? walletAddress.toLowerCase() : null;
  const guestHue = stableHueFromSeed("guest");

  const { showSkeletons, skeletonCount } = getSkeletonCount({
    isLoading,
    postsLength: posts.length,
    singleColumn
  });

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
          const { authorLabel, authorHue, authorAvatarUrl } = getAuthorPresentation({
            author: post.author,
            authorIdentity,
            shortAddress,
            guestHue
          });
          const isMine = !!walletLower && !!post.author && walletLower === post.author.toLowerCase();
          const canModerate = !!isOwner;
          const panelKey = `${post.chainId ?? ""}:${post.tokenId}`;
          const openPanel = getPanel(panelKey);
          const compositeKey = `${panelKey}:${post.contextTag ?? "post"}`;
          const isEditing = editingTokenId === post.tokenId;

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
              isEditing={isEditing}
              editDraft={isEditing ? editDraft : null}
              isEditImageLoading={isEditing ? isEditImageLoading : false}
              openPanel={openPanel}
              panelKey={panelKey}
              togglePanel={togglePanel}
              onSetEditDraft={onSetEditDraft}
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

        {showSkeletons ? <FeedSkeleton count={skeletonCount} /> : null}
      </div>
    </section>
  );
});
