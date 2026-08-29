import { useEffect, useMemo, useState } from "react";
import type { Post } from "@types";
import { useContractState } from "@features/contract";
import { useFeedMutations, useFeedQueries } from "@features/feed";
import { useProfileState } from "@features/profile";
import { buildPostPageViewModel } from "@features/post";
import { usePostActionsController } from "@features/post/actions";
import { useWalletState } from "@features/wallet";
import { getExplorerTxUrl, getNativeSymbol } from "@shared/lib/network";
import { shortAddress, stableHueFromSeed } from "@shared/lib/formatters";
import { commentKey } from "@features/post/services";
import { generateDemoPosts } from "@features/feed/services/demo/demoPosts";
import { generateDemoComments } from "@features/feed/services/demo/demoComments";
import { PostPage } from "./PostPage";

type Props = {
  tokenId: string;
  postChainId: string | null;
};

export function PostPageContainer({ tokenId, postChainId }: Props) {
  const wallet = useWalletState();
  const contract = useContractState();
  const feedState = useFeedQueries();
  const feedActions = useFeedMutations();
  const profile = useProfileState();
  const postActions = usePostActionsController();

  // Avoid a brief "not found" flash on hard refresh before wallet/provider + feed gating settle.
  // Also keep a local copy of fetched posts so the page can render without waiting on
  // global state flush.
  const [isPostLoading, setIsPostLoading] = useState(true);
  const [hasAttemptedLoad, setHasAttemptedLoad] = useState(false);
  const [localPost, setLocalPost] = useState<Post | null>(null);

  const isDemoTokenId = tokenId.startsWith("demo-");

  // While demo-mode is checking approval, the live feed is temporarily disabled.
  // Treat this as a loading state to prevent flashing "not found".
  const isApprovalLoadingGate =
    feedState.isDemoModeEnabled &&
    !!wallet.walletAddress &&
    !feedState.isLiveFeedEnabled &&
    feedState.demoStep === "approve" &&
    !!feedState.isFeedLoading;

  // NOTE: deliberately no "wait for the wallet provider" gate here.
  // Reads fall back to the configured RPC / subgraph (see getReadContext), so a logged-out
  // visitor can load a post and its comments. Gating on `wallet.provider` pinned the comments
  // spinner on forever for anyone without a connected wallet. When a provider does appear the
  // loader callbacks change identity, so the effects below re-run on their own.
  const demoSeed = useMemo(() => {
    if (!isDemoTokenId) return null;
    const parts = tokenId.split("-");
    const seedRaw = parts.length >= 2 ? parts[1] : "";
    const seed = Number(seedRaw);
    return Number.isFinite(seed) ? seed : null;
  }, [isDemoTokenId, tokenId]);

  const demoPost = useMemo(() => {
    if (!isDemoTokenId) return null;
    if (!feedState.isDemoModeEnabled) return null;
    if (demoSeed == null) return null;

    const posts = generateDemoPosts({
      seed: demoSeed,
      totalCount: 14,
      imagePostRatio: 0.65,
      featuredAuthor: wallet.walletAddress,
      featuredCount: 2
    });

    return (
      posts.find((p) => p.tokenId === tokenId && (postChainId ? String(p.chainId ?? "") === String(postChainId) : true)) ??
      null
    );
  }, [isDemoTokenId, feedState.isDemoModeEnabled, demoSeed, wallet.walletAddress, tokenId, postChainId]);

  const demoComments = useMemo(() => {
    if (!isDemoTokenId) return null;
    if (!feedState.isDemoModeEnabled) return null;
    const keyChainId = postChainId ?? null;
    const count = typeof demoPost?.comments === "number" ? demoPost.comments : 0;
    return generateDemoComments({ tokenId, postChainId: keyChainId, count });
  }, [isDemoTokenId, feedState.isDemoModeEnabled, tokenId, postChainId, demoPost?.comments]);

  const loadCommentsForPost = feedActions.loadCommentsForPost;
  const loadPostsByTokenIds = feedActions.loadPostsByTokenIds;

  // Reset local state between navigations.
  useEffect(() => {
    setHasAttemptedLoad(false);
    setLocalPost(null);
  }, [tokenId, postChainId]);

  useEffect(() => {
    if (isDemoTokenId) return;
    if (isApprovalLoadingGate) return;
    void loadCommentsForPost(tokenId, postChainId);
  }, [isDemoTokenId, isApprovalLoadingGate, tokenId, postChainId, loadCommentsForPost]);

  useEffect(() => {
    if (isDemoTokenId) {
      setIsPostLoading(false);
      setHasAttemptedLoad(true);
      return;
    }

    if (isApprovalLoadingGate) {
      setIsPostLoading(true);
      setHasAttemptedLoad(false);
      return;
    }

    let cancelled = false;
    setIsPostLoading(true);
    setHasAttemptedLoad(false);
    void (async () => {
      try {
        const result = await loadPostsByTokenIds([tokenId], postChainId);
        if (cancelled) return;

        if (result.didFetch) {
          setHasAttemptedLoad(true);

          const match =
            result.posts.find(
              (p) => p.tokenId === tokenId && (postChainId ? String(p.chainId ?? "") === String(postChainId) : true)
            ) ?? null;
          if (match) setLocalPost(match);
        }
      } finally {
        if (!cancelled) setIsPostLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isDemoTokenId, isApprovalLoadingGate, tokenId, postChainId, loadPostsByTokenIds]);

  const post =
    feedState.posts.find((p) => p.tokenId === tokenId && (postChainId ? String(p.chainId ?? "") === String(postChainId) : true)) ??
    localPost ??
    demoPost ??
    null;

  // Stop loading immediately once the post exists.
  useEffect(() => {
    if (isDemoTokenId) return;
    if (post) {
      setIsPostLoading(false);
      setHasAttemptedLoad(true);
    }
  }, [isDemoTokenId, post]);

  const commentsKey = commentKey(postChainId, tokenId);

  const isDemoGated = feedState.isDemoModeEnabled && (!feedState.isLiveFeedEnabled || isDemoTokenId);
  const isCommentsReadOnly = isDemoGated || !wallet.walletAddress;

  const resolvedComments = isDemoTokenId ? (demoComments ?? []) : feedState.postComments[commentsKey] ?? [];
  const resolvedIsLoadingComments =
    isDemoTokenId ? false : isApprovalLoadingGate ? true : !!feedState.isLoadingPostComments[commentsKey];
  const resolvedIsPostLoading =
    isDemoTokenId
      ? false
      : isApprovalLoadingGate
        ? true
        : post
          ? false
          : !hasAttemptedLoad
            ? true
            : isPostLoading;

  const viewModel = buildPostPageViewModel({
    isOwner: contract.isOwner,
    tokenId,
    postChainId,
    post,
    isPostLoading: resolvedIsPostLoading,
    comments: resolvedComments,
    isLoadingComments: resolvedIsLoadingComments,
    commentsReadOnly: isCommentsReadOnly,
    disableCommentAuthorProfileLookup: isDemoGated,
    posts: feedState.posts,
    chainId: wallet.chainId,
    walletAddress: wallet.walletAddress,
    authorIdentity: profile.authorIdentity,
    postActions,
    shortAddress,
    stableHueFromSeed,
    getNativeSymbol,
    getExplorerTxUrl
  });

  return <PostPage {...viewModel} />;
}
