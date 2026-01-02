import { memo, useMemo, type ReactNode } from "react";
import type { Post } from "@types";
import { useLocation } from "react-router-dom";
import type { PostPanel, PostActionsController } from "@features/post";
import { usePanelById } from "@shared/hooks/usePanelById";
import { getFeedFromLocation } from "./feed/getFeedFromLocation";
import { getSkeletonCount } from "./feed/getSkeletonCount";
import { FeedHeader } from "./feed/FeedHeader";
import { FeedPostList } from "./feed/FeedPostList";
import { getFeedEntries } from "./feed/getFeedEntries";

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

  const postEntries = useMemo(
    () =>
      getFeedEntries({
        posts,
        authorIdentity,
        shortAddress,
        guestHue,
        walletLower,
        isOwner
      }),
    [posts, authorIdentity, shortAddress, guestHue, walletLower, isOwner]
  );

  return (
    <section className="feed">
      <FeedHeader
        title={title}
        pillText={pillText}
        postsCount={posts.length}
        headerInlineAction={headerInlineAction}
        headerAction={headerAction}
        headerActionPlacement={headerActionPlacement}
        hideHeader={hideHeader}
      />

      <FeedPostList
        posts={posts}
        isLoading={isLoading}
        showSkeletons={showSkeletons}
        skeletonCount={skeletonCount}
        singleColumn={singleColumn}
        chainId={chainId}
        walletAddress={walletAddress}
        shortAddress={shortAddress}
        stableHueFromSeed={stableHueFromSeed}
        getNativeSymbol={getNativeSymbol}
        getExplorerTxUrl={getExplorerTxUrl}
        from={from}
        postActions={postActions}
        postEntries={postEntries}
        panelById={panelById}
        togglePanel={togglePanel}
      />
    </section>
  );
});
