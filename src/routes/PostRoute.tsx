import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { PostPage } from "../pages/PostPage";
import { useApp } from "../contexts/AppContext";

export function PostRoute() {
  const app = useApp();
  const params = useParams();
  const tokenId = params.tokenId as string | undefined;

  useEffect(() => {
    if (!tokenId) return;
    void app.loadCommentsForPost(tokenId);
  }, [tokenId, app.loadCommentsForPost]);

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

  const post = app.posts.find((p) => p.tokenId === tokenId) ?? null;

  return (
    <PostPage
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
