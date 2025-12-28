import { useEffect, useState } from "react";
import { Navigate, useLocation, useParams } from "react-router-dom";
import { PostPage } from "../pages/PostPage";
import { useContract } from "../contexts/ContractContext";
import { useFeed } from "../contexts/FeedContext";
import { useProfile } from "../contexts/ProfileContext";
import { useSocialActions } from "../contexts/SocialActionsContext";
import { useWallet } from "../contexts/WalletContext";
import { getExplorerTxUrl, getNativeSymbol } from "../lib/chain";
import { shortAddress, stableHueFromSeed } from "../lib/format";
import { useCallback } from "react";

export function PostRoute() {
  const wallet = useWallet();
  const contract = useContract();
  const feed = useFeed();
  const profile = useProfile();
  const social = useSocialActions();
  const params = useParams();
  const location = useLocation();
  const tokenId = params.tokenId as string | undefined;
  const stateChainId = (location.state as { chainId?: string | null } | null)?.chainId ?? null;
  const paramChainId = (params.chainId as string | undefined) ?? null;
  const postChainId = paramChainId ?? stateChainId;

  const [isPostLoading, setIsPostLoading] = useState(false);

  const loadCommentsForPost = feed.loadCommentsForPost;
  const loadPostsByTokenIds = feed.loadPostsByTokenIds;

  // If we navigated internally with chainId in state, prefer the canonical URL.
  if (tokenId && !paramChainId && stateChainId) {
    return <Navigate to={`/post/${stateChainId}/${tokenId}`} replace state={location.state} />;
  }

  useEffect(() => {
    if (!tokenId) return;
    void loadCommentsForPost(tokenId, postChainId);
  }, [tokenId, postChainId, loadCommentsForPost]);

  useEffect(() => {
    if (!tokenId) return;
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

  const onTip = useCallback(
    async (id: string, amountRaw: string, chain?: string | null) => {
      const ok = await social.handleTip(id, amountRaw, chain);
      if (!ok) return false;
      try {
        await contract.refreshContractState();
      } catch {
        // ignore
      }
      return true;
    },
    [social, contract]
  );

  if (!tokenId) {
    return (
      <main className="home">
        <section className="card">
          <div className="cardTitle">Post</div>
          <div className="muted">Missing token id.</div>
        </section>
      </main>
    );
  }

  const post =
    feed.posts.find((p) => p.tokenId === tokenId && (postChainId ? p.chainId === postChainId : true)) ?? null;

  const commentsKey = postChainId ? `${postChainId}:${tokenId}` : tokenId;

  return (
    <PostPage
      isOwner={contract.isOwner}
      tokenId={tokenId}
      postChainId={postChainId}
      post={post}
      isLoadingPost={isPostLoading && !post}
      comments={feed.postComments[commentsKey] ?? []}
      isLoadingComments={!!feed.isLoadingPostComments[commentsKey]}
      posts={feed.posts}
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
