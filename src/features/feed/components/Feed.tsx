import { memo, useMemo } from "react";
import { useLocation } from "react-router-dom";
import type { PostPanel } from "@features/post/components/postCard/postPanel";
import { usePanelById } from "@shared/hooks/usePanelById";
import { normalizeAddress } from "@shared/lib/address";
import { FeedHeader, FeedPostList, getFeedFromLocation, getSkeletonCount } from "./feed/index";
import { getFeedEntries } from "../viewModel";
import type { FeedViewModel } from "../types";
import { stableHueFromSeed } from "@shared/lib/format";

export const Feed = memo(function Feed({
  title,
  pillText,
  banner,
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
}: FeedViewModel) {
  const location = useLocation();
  const from = getFeedFromLocation(location);
  const { panelById, togglePanel } = usePanelById<PostPanel>();

  const walletLower = walletAddress ? normalizeAddress(walletAddress) : null;
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
        guestHue,
        walletLower,
        isOwner
      }),
    [posts, authorIdentity, guestHue, walletLower, isOwner]
  );

  return (
    <section className="feed">
      {banner ?? null}
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
        from={from}
        postActions={postActions}
        postEntries={postEntries}
        panelById={panelById}
        togglePanel={togglePanel}
      />
    </section>
  );
});
