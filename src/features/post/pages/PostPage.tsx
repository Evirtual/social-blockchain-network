import { Link, useLocation } from "react-router-dom";
import { CommentsCard, PostFeedPanel } from "../components";
import type { PostPageViewModel } from "@features/post";

export function PostPage(props: PostPageViewModel) {
  const location = useLocation();

  const from = (location.state as { from?: string } | null)?.from;
  const current = `${location.pathname}${location.search}`;
  const safeFrom =
    typeof from === "string" &&
    from.length > 0 &&
    from.startsWith("/") &&
    from !== current &&
    !from.startsWith("/post/")
      ? from
      : "/";

  const title = "Post";

  return (
    <main className="home">
      <div className="pageHeader">
        <Link className="btn ghost" to={safeFrom} replace>
          ← Home
        </Link>
        <div className="pageHeaderTitle">{title}</div>
      </div>

      <div className="postSplit">
        <div className="postLeft">
          <PostFeedPanel
            title={title}
            post={props.post}
            isLoadingPost={props.isLoadingPost}
            isOwner={props.isOwner}
          chainId={props.chainId}
          walletAddress={props.walletAddress}
          authorIdentity={props.authorIdentity}
          postActions={props.postActions}
          shortAddress={props.shortAddress}
          stableHueFromSeed={props.stableHueFromSeed}
          getNativeSymbol={props.getNativeSymbol}
            getExplorerTxUrl={props.getExplorerTxUrl}
          />
        </div>

        <div className="postRight">
          <CommentsCard
            tokenId={props.tokenId}
            postChainId={props.postChainId}
            chainId={props.chainId}
            walletAddress={props.walletAddress}
            canModerateComments={props.isOwner}
            forceReadOnly={!!props.commentsReadOnly}
            allowCommenting={!props.commentsReadOnly}
            disableAuthorProfileLookup={!!props.disableCommentAuthorProfileLookup}
            comments={props.comments}
            isLoadingComments={props.isLoadingComments}
            onAction={props.postActions.onAction}
            onReply={props.postActions.replyToComment}
            onEditComment={props.postActions.editComment}
            onDeleteComment={props.postActions.deleteComment}
            onToggleCommentLike={props.postActions.toggleCommentLike}
            onToggleCommentSave={props.postActions.toggleCommentSave}
            onTipComment={props.postActions.tipComment}
            onReportPost={props.postActions.reportPost}
            onReportComment={props.postActions.reportComment}
            shortAddress={props.shortAddress}
            stableHueFromSeed={props.stableHueFromSeed}
            getExplorerTxUrl={props.getExplorerTxUrl}
            getNativeSymbol={props.getNativeSymbol}
          />
        </div>
      </div>
    </main>
  );
}
