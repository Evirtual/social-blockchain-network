import { memo, useMemo, type ReactNode } from "react";
import type { Post } from "@types";
import { useLocation } from "react-router-dom";
import { PostCard, type PostPanel, type PostActionsController } from "@features/post";
import { usePanelById } from "@shared/hooks/usePanelById";
import { getFeedFromLocation } from "./feed/getFeedFromLocation";
import { getSkeletonCount } from "./feed/getSkeletonCount";
import { FeedSkeleton } from "./feed/FeedSkeleton";
import { getAuthorPresentation } from "./feed/getAuthorPresentation";

type Props = {
  title?: string;
  pillText?: string;
  headerInlineAction?: ReactNode;
  headerAction?: ReactNode;
  headerActionPlacement?: "right" | "inline";
  singleColumn?: boolean;
  hideHeader?: boolean;
  isLoading?: boolean;
  loadingText?: string;
  posts: Post[];
  isOwner?: boolean;
  chainId: string | null;
  walletAddress: string | null;
  authorIdentity: Map<string, { name: string; hue: number; avatarUrl?: string }>;

  postActions: PostActionsController;

  shortAddress: (address: string) => string;
  stableHueFromSeed: (seed: string) => number;
  getNativeSymbol: (chainId: string | null) => string;
  getExplorerTxUrl: (chainId: string | null, txHash: string) => string | null;
};

export const Feed = memo(function Feed({
  title,
  pillText,
  headerInlineAction,
  headerAction,
  headerActionPlacement,
  singleColumn,
  hideHeader,
  isLoading,
  posts,
  isOwner,
  chainId,
  walletAddress,
  authorIdentity,
  postActions,
  shortAddress,
  stableHueFromSeed,
  getNativeSymbol,
  getExplorerTxUrl
}: Props) {
  const location = useLocation();
  const from = getFeedFromLocation(location);
  const { panelById, togglePanel } = usePanelById<PostPanel>();

  const walletLower = walletAddress ? walletAddress.toLowerCase() : null;
  const guestHue = stableHueFromSeed("guest");

  const { showSkeletons, skeletonCount } = useMemo(() => {
    return getSkeletonCount({
      isLoading,
      postsLength: posts.length,
      singleColumn
    });
  }, [isLoading, posts.length, singleColumn]);

  const actionPlacement = headerActionPlacement ?? "right";
  const inlineAction = headerInlineAction ?? (actionPlacement === "inline" ? headerAction : null);
  const rightAction = actionPlacement === "inline" ? null : headerAction;

  const postEntries = useMemo(() => {
    return posts.map((post) => {
      const { authorLabel, authorHue, authorAvatarUrl } = getAuthorPresentation({
        author: post.author,
        authorIdentity,
        shortAddress,
        guestHue
      });
      const isMine = !!walletLower && !!post.author && walletLower === post.author.toLowerCase();
      const canModerate = !!isOwner;
      const panelKey = `${post.chainId ?? ""}:${post.tokenId}`;
      const compositeKey = `${panelKey}:${post.contextTag ?? "post"}`;

      return {
        post,
        authorLabel,
        authorHue,
        authorAvatarUrl,
        isMine,
        canModerate,
        panelKey,
        compositeKey
      };
    });
  }, [posts, authorIdentity, shortAddress, guestHue, walletLower, isOwner]);

  return (
    <section className="feed">
      {hideHeader ? null : (
        <div className="feed-header">
          <div className="feedHeaderLeft">
            <h2 className="feedHeaderTitle">{title ?? "Chain Feed"}</h2>
            {inlineAction ? <div className="feedHeaderInlineAction">{inlineAction}</div> : null}
          </div>

          {rightAction ? <div className="feedHeaderAction">{rightAction}</div> : null}
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
        {postEntries.map((entry, index) => {
          const openPanel = panelById[entry.panelKey] ?? null;
          const isEditing = postActions.editingTokenId === entry.panelKey;

          return (
            <PostCard
              key={entry.compositeKey}
              post={entry.post}
              animationDelayMs={index * 80}
              from={from}
              chainId={chainId}
              walletAddress={walletAddress}
              authorLabel={entry.authorLabel}
              authorHue={entry.authorHue}
              authorAvatarUrl={entry.authorAvatarUrl}
              isMine={entry.isMine}
              canModerate={entry.canModerate}
              isEditing={isEditing}
              editDraft={isEditing ? postActions.editDraft : null}
              isEditImageLoading={isEditing ? postActions.isEditImageLoading : false}
              openPanel={openPanel}
              panelKey={entry.panelKey}
              togglePanel={togglePanel}
              onSetEditDraft={postActions.onSetEditDraft}
              onStartEditPost={postActions.onStartEditPost}
              onCancelEditPost={postActions.onCancelEditPost}
              onSaveEditedPost={postActions.onSaveEditedPost}
              onEditSelectFile={postActions.onEditSelectFile}
              onEditClearImage={postActions.onEditClearImage}
              onAction={postActions.onAction}
              onTip={postActions.onTip}
              onBurn={postActions.onBurn}
              onFreezePost={postActions.onFreezePost}
              shortAddress={shortAddress}
              stableHueFromSeed={stableHueFromSeed}
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
