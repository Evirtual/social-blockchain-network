import { useEffect, useMemo, useState } from "react";
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

  // Default to loading to avoid a brief "not found" flash on hard refresh,
  // before wallet/provider + feed gating settle.
  const [isPostLoading, setIsPostLoading] = useState(true);
  const [loadFinishedAt, setLoadFinishedAt] = useState<number | null>(null);

  const isDemoTokenId = tokenId.startsWith("demo-");

  // While demo-mode is checking approval, the live feed is temporarily disabled.
  // Treat this as a loading state to prevent flashing "not found".
  const isApprovalLoadingGate =
    feedState.isDemoModeEnabled &&
    !!wallet.walletAddress &&
    !feedState.isLiveFeedEnabled &&
    feedState.demoStep === "approve" &&
    !!feedState.isFeedLoading;

  // On hard refresh, the wallet provider can be null briefly even though the user is connected.
  // Keep skeleton until provider is ready so loaders don't early-return and flicker.
  const isProviderNotReadyGate = !isDemoTokenId && feedState.isLiveFeedEnabled && !wallet.provider;
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

  useEffect(() => {
    if (isDemoTokenId) return;
    if (isApprovalLoadingGate) return;
    if (isProviderNotReadyGate) return;
    void loadCommentsForPost(tokenId, postChainId);
  }, [isDemoTokenId, isApprovalLoadingGate, isProviderNotReadyGate, tokenId, postChainId, loadCommentsForPost]);

  useEffect(() => {
    if (isDemoTokenId) {
      setIsPostLoading(false);
      setLoadFinishedAt(null);
      return;
    }

    if (isApprovalLoadingGate || isProviderNotReadyGate) {
      setIsPostLoading(true);
      setLoadFinishedAt(null);
      return;
    }

    let cancelled = false;
    setIsPostLoading(true);
    setLoadFinishedAt(null);
    void (async () => {
      try {
        await loadPostsByTokenIds([tokenId], postChainId);
      } finally {
        if (!cancelled) setLoadFinishedAt(Date.now());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isDemoTokenId, isApprovalLoadingGate, isProviderNotReadyGate, tokenId, postChainId, loadPostsByTokenIds]);

  const post =
    feedState.posts.find((p) => p.tokenId === tokenId && (postChainId ? p.chainId === postChainId : true)) ??
    demoPost ??
    null;

  // Stop loading immediately once the post exists.
  useEffect(() => {
    if (isDemoTokenId) return;
    if (post) {
      setIsPostLoading(false);
      setLoadFinishedAt(null);
    }
  }, [isDemoTokenId, post]);

  // If a load attempt finished but React hasn't flushed the merged post into the feed yet,
  // keep the skeleton for a short settle window to avoid flashing "not found".
  useEffect(() => {
    if (isDemoTokenId) return;
    if (post) return;
    if (loadFinishedAt == null) return;
    if (isApprovalLoadingGate || isProviderNotReadyGate) return;

    const t = window.setTimeout(() => {
      setIsPostLoading(false);
    }, 250);
    return () => window.clearTimeout(t);
  }, [isDemoTokenId, post, loadFinishedAt, isApprovalLoadingGate, isProviderNotReadyGate]);

  const commentsKey = commentKey(postChainId, tokenId);

  const isDemoGated = feedState.isDemoModeEnabled && (!feedState.isLiveFeedEnabled || isDemoTokenId);
  const isCommentsReadOnly = isDemoGated || !wallet.walletAddress;

  const resolvedComments = isDemoTokenId ? (demoComments ?? []) : feedState.postComments[commentsKey] ?? [];
  const resolvedIsLoadingComments =
    isDemoTokenId ? false : isApprovalLoadingGate || isProviderNotReadyGate ? true : !!feedState.isLoadingPostComments[commentsKey];
  const resolvedIsPostLoading = isDemoTokenId ? false : isApprovalLoadingGate || isProviderNotReadyGate ? true : isPostLoading;

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
