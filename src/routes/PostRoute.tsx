import { useEffect } from "react";
import { useLocation, useParams } from "react-router-dom";
import { PostPage } from "../pages/PostPage";
import { useApp } from "../contexts/AppContext";

export function PostRoute() {
  const app = useApp();
  const params = useParams();
  const location = useLocation();
  const tokenId = params.tokenId as string | undefined;
  const postChainId = (location.state as { chainId?: string | null } | null)?.chainId ?? null;

  useEffect(() => {
    if (!tokenId) return;
    if (postChainId && app.chainId && postChainId !== app.chainId) return;
    void app.loadCommentsForPost(tokenId);
  }, [tokenId, postChainId, app.chainId, app.loadCommentsForPost]);

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
    app.posts.find((p) => p.tokenId === tokenId && (postChainId ? p.chainId === postChainId : true)) ?? null;

  return (
    <PostPage
      isOwner={app.isOwner}
      tokenId={tokenId}
      post={post}
      comments={app.postComments[tokenId] ?? []}
      isLoadingComments={!!app.isLoadingPostComments[tokenId]}
      posts={app.posts}
      chainId={app.chainId}
      walletAddress={app.walletAddress}
      authorIdentity={app.authorIdentity}
      editingTokenId={app.editingTokenId}
      editDraft={app.editDraft}
      isEditImageLoading={app.isEditImageLoading}
      tipDrafts={app.tipDrafts}
      commentDrafts={app.commentDrafts}
      onSetEditDraft={app.setEditDraft}
      onTipDraftChange={app.onTipDraftChange}
      onCommentDraftChange={app.onCommentDraftChange}
      onStartEditPost={app.startEditPost}
      onCancelEditPost={app.cancelEditPost}
      onSaveEditedPost={app.saveEditedPost}
      onEditSelectFile={app.onEditSelectFile}
      onEditClearImage={app.onEditClearImage}
      onAction={app.handleAction}
      onTip={app.handleTip}
      onBurn={app.burnPost}
      onFreezePost={app.freezePost}
      shortAddress={app.shortAddress}
      stableHueFromSeed={app.stableHueFromSeed}
      getNativeSymbol={app.getNativeSymbol}
      getExplorerTxUrl={app.getExplorerTxUrl}
    />
  );
}
