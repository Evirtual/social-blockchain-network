import { useEffect, useState } from "react";
import { useTipWithRefresh } from "@features/social";
import { useContractState } from "@features/contract";
import { useFeedActions, useFeedState } from "@features/feed";
import { useProfileState } from "@features/profile";
import { useSocialActions } from "@features/social";
import { useWalletState } from "@features/wallet";
import { getExplorerTxUrl, getNativeSymbol } from "@shared/lib/chain";
import { shortAddress, stableHueFromSeed } from "@shared/lib/format";
import { PostPage } from "./PostPage";

type Props = {
  tokenId: string;
  postChainId: string | null;
};

export function PostPageContainer({ tokenId, postChainId }: Props) {
  const wallet = useWalletState();
  const contract = useContractState();
  const feedState = useFeedState();
  const feedActions = useFeedActions();
  const profile = useProfileState();
  const social = useSocialActions();

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

  const onTip = useTipWithRefresh();

  const post =
    feedState.posts.find((p) => p.tokenId === tokenId && (postChainId ? p.chainId === postChainId : true)) ?? null;

  const commentsKey = postChainId ? `${postChainId}:${tokenId}` : tokenId;

  return (
    <PostPage
      isOwner={contract.isOwner}
      tokenId={tokenId}
      postChainId={postChainId}
      post={post}
      isLoadingPost={isPostLoading && !post}
      comments={feedState.postComments[commentsKey] ?? []}
      isLoadingComments={!!feedState.isLoadingPostComments[commentsKey]}
      posts={feedState.posts}
      chainId={wallet.chainId}
      walletAddress={wallet.walletAddress}
      authorIdentity={profile.authorIdentity}
      editingTokenId={social.editingTokenId}
      editDraft={social.editDraft}
      isEditImageLoading={social.isEditImageLoading}
      onSetEditDraft={social.setEditDraft}
      onStartEditPost={social.startEditPost}
      onCancelEditPost={social.cancelEditPost}
      onSaveEditedPost={social.saveEditedPost}
      onEditSelectFile={social.onEditSelectFile}
      onEditClearImage={social.onEditClearImage}
      onAction={social.handleAction}
      onTip={onTip}
      onBurn={social.burnPost}
      onFreezePost={social.freezePost}
      shortAddress={shortAddress}
      stableHueFromSeed={stableHueFromSeed}
      getNativeSymbol={getNativeSymbol}
      getExplorerTxUrl={getExplorerTxUrl}
    />
  );
}
