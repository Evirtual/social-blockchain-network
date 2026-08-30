import { useEffect, useState } from "react";
import type { Post } from "@types";
import { useContractState } from "@features/contract";
import { useFeedMutations, useFeedQueries } from "@features/feed";
import { useProfileState } from "@features/profile";
import { buildPostPageViewModel } from "@features/post";
import { usePostActionsController } from "@features/post/actions";
import { useWalletState } from "@features/wallet";
import { commentKey } from "@features/post/services";
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

  // NOTE: deliberately no "wait for the wallet provider" gate here.
  // Reads fall back to the configured RPC / subgraph (see getReadContext), so a logged-out
  // visitor can load a post and its comments. Gating on `wallet.provider` pinned the comments
  // spinner on forever for anyone without a connected wallet. When a provider does appear the
  // loader callbacks change identity, so the effects below re-run on their own.
  const loadCommentsForPost = feedActions.loadCommentsForPost;
  const loadPostsByTokenIds = feedActions.loadPostsByTokenIds;

  // Reset local state between navigations.
  useEffect(() => {
    setHasAttemptedLoad(false);
    setLocalPost(null);
  }, [tokenId, postChainId]);

  useEffect(() => {
    void loadCommentsForPost(tokenId, postChainId);
  }, [tokenId, postChainId, loadCommentsForPost]);

  useEffect(() => {
    if (false) {
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
  }, [tokenId, postChainId, loadPostsByTokenIds]);

  const post =
    feedState.posts.find((p) => p.tokenId === tokenId && (postChainId ? String(p.chainId ?? "") === String(postChainId) : true)) ??
    localPost ??
    null;

  // Stop loading immediately once the post exists.
  useEffect(() => {
    if (post) {
      setIsPostLoading(false);
      setHasAttemptedLoad(true);
    }
  }, [post]);

  const commentsKey = commentKey(postChainId, tokenId);

  const isCommentsReadOnly = !wallet.walletAddress;

  const resolvedComments = feedState.postComments[commentsKey] ?? [];
  const resolvedIsLoadingComments = !!feedState.isLoadingPostComments[commentsKey];
  const resolvedIsPostLoading =
    false
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
    posts: feedState.posts,
    chainId: wallet.chainId,
    walletAddress: wallet.walletAddress,
    authorIdentity: profile.authorIdentity,
    postActions,
  });

  return <PostPage {...viewModel} />;
}
