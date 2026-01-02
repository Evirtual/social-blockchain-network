import type { PostComment } from "@types";
import { useCallback, useMemo, useState } from "react";
import { getPostNetworkUi } from "@shared/lib/network";
import { CommentItem } from "./comments/CommentItem";
import { NewCommentComposer } from "./comments/NewCommentComposer";
import type { ActionInFlight, ActiveComposer } from "./comments/types";

type Props = {
  tokenId: string;
  postChainId: string | null;
  chainId: string | null;
  walletAddress: string | null;
  useCardWrapper?: boolean;
  allowCommenting?: boolean;
  canModerateComments?: boolean;

  comments: PostComment[];
  isLoadingComments: boolean;

  onAction: (
    tokenId: string,
    action: "like" | "comment" | "save",
    postChainId?: string | null,
    comment?: string
  ) => Promise<boolean>;
  onReply: (tokenId: string, parentCommentId: string, comment: string, postChainId?: string | null) => Promise<boolean>;
  onEditComment: (tokenId: string, commentId: string, comment: string, postChainId?: string | null) => Promise<boolean>;
  onDeleteComment: (tokenId: string, commentId: string, postChainId?: string | null) => Promise<boolean>;
  onToggleCommentLike: (tokenId: string, commentId: string, postChainId?: string | null) => Promise<boolean>;
  onToggleCommentSave: (tokenId: string, commentId: string, postChainId?: string | null) => Promise<boolean>;
  onTipComment: (tokenId: string, commentId: string, amountRaw: string, postChainId?: string | null) => Promise<boolean>;
  onReportPost: (tokenId: string, reason: string, postChainId?: string | null) => Promise<boolean>;
  onReportComment: (tokenId: string, commentId: string, reason: string, postChainId?: string | null) => Promise<boolean>;

  shortAddress: (address: string) => string;
  stableHueFromSeed: (seed: string) => number;
  getExplorerTxUrl: (chainId: string | null, txHash: string) => string | null;
  getNativeSymbol: (chainId: string | null) => string;
};

export function CommentsCard(props: Props) {
  const [commentDraft, setCommentDraft] = useState<string>("");
  const [activeComposer, setActiveComposer] = useState<ActiveComposer>({ type: null });
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [editDrafts, setEditDrafts] = useState<Record<string, string>>({});
  const [tipDrafts, setTipDrafts] = useState<Record<string, string>>({});
  const [reportDrafts, setReportDrafts] = useState<Record<string, string>>({});
  const [isSigning, setIsSigning] = useState(false);
  const [actionInFlight, setActionInFlight] = useState<ActionInFlight>({
    id: null,
    action: null
  });

  const { requiresNetworkSwitch, interactionDisabledTitle } = getPostNetworkUi({
    postChainId: props.postChainId,
    chainId: props.chainId,
    walletAddress: props.walletAddress
  });

  const explorerChainId = props.postChainId ?? props.chainId;
  const nativeSymbol = props.getNativeSymbol(explorerChainId);
  const walletLower = props.walletAddress?.toLowerCase() ?? null;
  const { rootIdById, authorById } = useMemo(() => {
    const commentIds = new Set<string>();
    const parentById = new Map<string, string | null>();
    const authorMap = new Map<string, string>();
    props.comments.forEach((comment) => {
      commentIds.add(comment.commentId);
      parentById.set(comment.commentId, comment.parentId ?? null);
      authorMap.set(comment.commentId, comment.author);
    });

    const rootMap = new Map<string, string>();
    props.comments.forEach((comment) => {
      let current = comment.commentId;
      let parent = parentById.get(current);
      let guard = 0;
      while (parent && commentIds.has(parent) && guard < 10) {
        current = parent;
        parent = parentById.get(current) ?? null;
        guard += 1;
      }
      rootMap.set(comment.commentId, current);
    });

    return { rootIdById: rootMap, authorById: authorMap };
  }, [props.comments]);

  const rootComments = useMemo(
    () => props.comments.filter((comment) => rootIdById.get(comment.commentId) === comment.commentId),
    [props.comments, rootIdById]
  );

  const onSubmitComment = useCallback(async () => {
    if (isSigning) return;
    setIsSigning(true);
    try {
      const ok = await props.onAction(props.tokenId, "comment", props.postChainId, commentDraft);
      if (ok) setCommentDraft("");
    } finally {
      setIsSigning(false);
    }
  }, [props, commentDraft, isSigning]);

  const wrapperClassName = props.useCardWrapper === false ? undefined : "card";

  const allowCommenting = props.allowCommenting ?? !requiresNetworkSwitch;

  return (
    <section className={wrapperClassName}>
      {allowCommenting ? (
        <NewCommentComposer
          value={commentDraft}
          onChange={setCommentDraft}
          onSubmit={onSubmitComment}
          isSigning={isSigning}
          requiresNetworkSwitch={requiresNetworkSwitch}
          interactionDisabledTitle={interactionDisabledTitle}
        />
      ) : null}

      {props.isLoadingComments && props.comments.length === 0 ? (
        <div className="commentList" aria-busy={true} aria-label="Loading comments" role="status">
          {Array.from({ length: 1 }).map((_, idx) => (
            <article key={`comment-skeleton-${idx}`} className="post postSkeleton comment" aria-hidden="true">
              <div className="postHead">
                <div className="avatar small skeleton" />
                <div className="postHeadMain">
                  <div className="postHeadTop">
                    <div className="skeletonLine" style={{ width: "40%" }} />
                    <div className="skeletonLine" style={{ width: "22%" }} />
                  </div>
                </div>
              </div>

              <div className="post-body">
                <div className="skeletonLine" style={{ width: "92%" }} />
                <div className="skeletonLine" style={{ width: "84%" }} />
                <div className="skeletonLine" style={{ width: "66%" }} />
              </div>
            </article>
          ))}
        </div>
      ) : props.comments.length === 0 ? (
        <div className="commentEmpty">
          <div className="muted">No comments yet.</div>
        </div>
      ) : (
        <div className="commentList">
          {rootComments.map((c, idx) => {
            const replies = props.comments.filter(
              (comment) => rootIdById.get(comment.commentId) === c.commentId && comment.parentId
            );
            return (
              <article key={c.commentId ?? `${c.txHash ?? "nohash"}-${c.logIndex ?? idx}`} className="post comment">
                <CommentItem
                  comment={c}
                  tokenId={props.tokenId}
                  postChainId={props.postChainId}
                  explorerChainId={explorerChainId}
                  nativeSymbol={nativeSymbol}
                  walletLower={walletLower}
                  canModerateComments={props.canModerateComments}
                  requiresNetworkSwitch={requiresNetworkSwitch}
                  interactionDisabledTitle={interactionDisabledTitle}
                  isSigning={isSigning}
                  activeComposer={activeComposer}
                  setActiveComposer={setActiveComposer}
                  replyDrafts={replyDrafts}
                  setReplyDrafts={setReplyDrafts}
                  editDrafts={editDrafts}
                  setEditDrafts={setEditDrafts}
                  tipDrafts={tipDrafts}
                  setTipDrafts={setTipDrafts}
                  reportDrafts={reportDrafts}
                  setReportDrafts={setReportDrafts}
                  actionInFlight={actionInFlight}
                  setActionInFlight={setActionInFlight}
                  onReply={props.onReply}
                  onEditComment={props.onEditComment}
                  onDeleteComment={props.onDeleteComment}
                  onToggleCommentLike={props.onToggleCommentLike}
                  onToggleCommentSave={props.onToggleCommentSave}
                  onTipComment={props.onTipComment}
                  onReportComment={props.onReportComment}
                  shortAddress={props.shortAddress}
                  stableHueFromSeed={props.stableHueFromSeed}
                  getExplorerTxUrl={props.getExplorerTxUrl}
                />
                {replies.length ? (
                  <div className="commentReplies">
                    {replies.map((reply, replyIdx) => (
                      <div
                        key={reply.commentId ?? `${reply.txHash ?? "nohash"}-${reply.logIndex ?? replyIdx}`}
                        className="commentReply"
                      >
                        <CommentItem
                          comment={reply}
                          replyToAddress={reply.parentId ? authorById.get(reply.parentId) ?? reply.parentId : null}
                          tokenId={props.tokenId}
                          postChainId={props.postChainId}
                          explorerChainId={explorerChainId}
                          nativeSymbol={nativeSymbol}
                          walletLower={walletLower}
                          canModerateComments={props.canModerateComments}
                          requiresNetworkSwitch={requiresNetworkSwitch}
                          interactionDisabledTitle={interactionDisabledTitle}
                          isSigning={isSigning}
                          activeComposer={activeComposer}
                          setActiveComposer={setActiveComposer}
                          replyDrafts={replyDrafts}
                          setReplyDrafts={setReplyDrafts}
                          editDrafts={editDrafts}
                          setEditDrafts={setEditDrafts}
                          tipDrafts={tipDrafts}
                          setTipDrafts={setTipDrafts}
                          reportDrafts={reportDrafts}
                          setReportDrafts={setReportDrafts}
                          actionInFlight={actionInFlight}
                          setActionInFlight={setActionInFlight}
                          onReply={props.onReply}
                          onEditComment={props.onEditComment}
                          onDeleteComment={props.onDeleteComment}
                          onToggleCommentLike={props.onToggleCommentLike}
                          onToggleCommentSave={props.onToggleCommentSave}
                          onTipComment={props.onTipComment}
                          onReportComment={props.onReportComment}
                          shortAddress={props.shortAddress}
                          stableHueFromSeed={props.stableHueFromSeed}
                          getExplorerTxUrl={props.getExplorerTxUrl}
                        />
                      </div>
                    ))}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
