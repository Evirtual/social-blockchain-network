import { useEffect, useMemo } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { PostPage } from "../pages/PostPage";
import { useApp } from "../contexts/AppContext";

export function PostRoute() {
  const app = useApp();
  const params = useParams();
  const [searchParams] = useSearchParams();
  const tokenId = params.tokenId as string | undefined;

  const requestedChainId = useMemo(() => {
    const raw = searchParams.get("chainId");
    return raw && raw.trim().length ? raw.trim() : null;
  }, [searchParams]);

  useEffect(() => {
    if (!tokenId) return;
    // Comments are loaded via the currently-connected chain provider.
    // Avoid loading comments for posts from a different chain.
    if (requestedChainId && app.chainId && requestedChainId !== app.chainId) return;
    void app.loadCommentsForPost(tokenId);
  }, [tokenId, requestedChainId, app.chainId, app.loadCommentsForPost]);

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
    app.posts.find((p) => {
      if (p.tokenId !== tokenId) return false;
      if (!requestedChainId) return true;
      return (p.chainId ?? null) === requestedChainId;
    }) ?? null;

  const postChainId = requestedChainId ?? post?.chainId ?? app.chainId;

  return (
    <PostPage
      tokenId={tokenId}
      post={post}
      postChainId={postChainId}
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
      shortAddress={app.shortAddress}
      stableHueFromSeed={app.stableHueFromSeed}
      getNativeSymbol={app.getNativeSymbol}
      getExplorerTxUrl={app.getExplorerTxUrl}
    />
  );
}
