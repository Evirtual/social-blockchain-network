import { useEffect, useState } from "react";
import { useContractState } from "@features/contract";
import { useFeedMutations, useFeedQueries } from "@features/feed";
import { useProfileState } from "@features/profile";
import { buildPostPageViewModel } from "@features/post";
import { usePostActionsController } from "@features/post/actions";
import { useWalletState } from "@features/wallet";
import { getExplorerTxUrl, getNativeSymbol } from "@shared/lib/network";
import { shortAddress, stableHueFromSeed } from "@shared/lib/formatters";
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

  const [isPostLoading, setIsPostLoading] = useState(false);

  const loadCommentsForPost = feedActions.loadCommentsForPost;
  const loadPostsByTokenIds = feedActions.loadPostsByTokenIds;

  useEffect(() => {
    void loadCommentsForPost(tokenId, postChainId);
  }, [tokenId, postChainId, loadCommentsForPost]);

  useEffect(() => {
    let cancelled = false;
    setIsPostLoading(true);
    void (async () => {
      try {
        await loadPostsByTokenIds([tokenId], postChainId);
      } finally {
        if (!cancelled) setIsPostLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tokenId, postChainId, loadPostsByTokenIds]);

  const post =
    feedState.posts.find((p) => p.tokenId === tokenId && (postChainId ? p.chainId === postChainId : true)) ?? null;

  const commentsKey = commentKey(postChainId, tokenId);

  const isDemoGated = feedState.isDemoModeEnabled && !feedState.isLiveFeedEnabled;
  const isCommentsReadOnly = isDemoGated || !wallet.walletAddress;

  const viewModel = buildPostPageViewModel({
    isOwner: contract.isOwner,
    tokenId,
    postChainId,
    post,
    isPostLoading,
    comments: feedState.postComments[commentsKey] ?? [],
    isLoadingComments: !!feedState.isLoadingPostComments[commentsKey],
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
