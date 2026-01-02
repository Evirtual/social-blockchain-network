import type { PostComment } from "@types";
import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { IconBookmark, IconCoin, IconEdit, IconFlag, IconHeart, IconMessage, IconRepeat, IconTrash } from "@features/app";
import { getPostNetworkUi } from "@shared/lib/network";
import { getStatButtonClass } from "./postCard/footer/getStatButtonClass";

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
  const [activeComposer, setActiveComposer] = useState<{
    type: "reply" | "edit" | "tip" | "report" | "post-report" | null;
    commentId?: string;
  }>({ type: null });
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [editDrafts, setEditDrafts] = useState<Record<string, string>>({});
  const [tipDrafts, setTipDrafts] = useState<Record<string, string>>({});
  const [reportDrafts, setReportDrafts] = useState<Record<string, string>>({});
  const [isSigning, setIsSigning] = useState(false);
  const [actionInFlight, setActionInFlight] = useState<{ id: string | null; action: string | null }>({
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

  const renderComment = (comment: PostComment, replyToAddress?: string | null) => {
    const hue = props.stableHueFromSeed(comment.author.toLowerCase());
    const label = props.shortAddress(comment.author);
    const explorer = comment.txHash ? props.getExplorerTxUrl(explorerChainId, comment.txHash) : null;
    const isMine = !!walletLower && comment.author.toLowerCase() === walletLower;
    const canEdit = isMine && !comment.deleted;
    const canDelete = (isMine || props.canModerateComments) && !comment.deleted;
    const isBusy = actionInFlight.id === comment.commentId;
    const likeCount = comment.likeCount ?? 0;
    const saveCount = comment.saveCount ?? 0;
    const isLikeBusy = isBusy && actionInFlight.action === "like";
    const isSaveBusy = isBusy && actionInFlight.action === "save";
    const isDeleteBusy = isBusy && actionInFlight.action === "delete";
    const isReplyBusy = isBusy && actionInFlight.action === "reply";
    const isEditBusy = isBusy && actionInFlight.action === "edit";
    const isTipBusy = isBusy && actionInFlight.action === "tip";
    const isReportBusy = isBusy && actionInFlight.action === "report";

    return (
      <>
        <div className="postHead">
          <div className="avatar small" style={{ background: `hsl(${hue} 75% 55%)` }} />
          <div className="postHeadMain">
            <div className="postHeadTop">
              <div className="postAuthor">
                <Link to={`/profile/${comment.author}`}>{label}</Link>
                {comment.edited ? <span className="badge">Edited</span> : null}
                {comment.deleted ? <span className="badge">Deleted</span> : null}
              </div>
              <div className="postTokenArea">
                <span className="postTokenActions">
                  {explorer ? (
                    <a
                      className="ghost iconButton commentLink"
                      href={explorer}
                      target="_blank"
                      rel="noreferrer"
                      aria-label="View transaction"
                      title="View transaction"
                    >
                      <IconRepeat size={16} />
                    </a>
                  ) : null}
                  <button
                    className="ghost iconButton"
                    type="button"
                    onClick={() => {
                      setActiveComposer({ type: "report", commentId: comment.commentId });
                      setReportDrafts((prev) => ({ ...prev, [comment.commentId]: prev[comment.commentId] ?? "" }));
                    }}
                    disabled={requiresNetworkSwitch || isBusy}
                    aria-busy={isReportBusy}
                    aria-label="Report comment"
                    title="Report"
                  >
                    <IconFlag size={14} />
                  </button>
                  {canEdit ? (
                    <button
                      className="ghost iconButton"
                      type="button"
                      onClick={() => {
                        setActiveComposer({ type: "edit", commentId: comment.commentId });
                        setEditDrafts((prev) => ({ ...prev, [comment.commentId]: comment.comment }));
                      }}
                      disabled={requiresNetworkSwitch || isBusy}
                      aria-label="Edit comment"
                      title="Edit"
                    >
                      <IconEdit size={14} />
                    </button>
                  ) : null}
                  {canDelete ? (
                    <button
                      className="ghost iconButton danger"
                      type="button"
                      onClick={async () => {
                        setActionInFlight({ id: comment.commentId, action: "delete" });
                        try {
                          await props.onDeleteComment(props.tokenId, comment.commentId, props.postChainId);
                        } finally {
                          setActionInFlight({ id: null, action: null });
                        }
                      }}
                      disabled={requiresNetworkSwitch || isBusy}
                      aria-busy={isDeleteBusy}
                      aria-label="Delete comment"
                      title="Delete"
                    >
                      {isDeleteBusy ? <span className="spinner" aria-hidden="true" /> : <IconTrash size={14} />}
                    </button>
                  ) : null}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="post-body">
          <div className="postText">
            <p className={comment.deleted ? "commentText isDeleted" : undefined}>
              {comment.deleted ? (
                "Comment deleted."
              ) : (
                <>
                  {replyToAddress ? (
                    <Link className="commentReplyTo" to={`/profile/${replyToAddress}`}>
                      @{props.shortAddress(replyToAddress)}
                    </Link>
                  ) : null}
                  {comment.comment}
                </>
              )}
            </p>
          </div>
        </div>

        <div className="postFooter">
          <div className="postStats">
            <button
              className={getStatButtonClass({
                requiresNetworkSwitch,
                active: comment.likedByMe ? "isActive isLike" : ""
              })}
              type="button"
              onClick={async () => {
                setActionInFlight({ id: comment.commentId, action: "like" });
                try {
                  await props.onToggleCommentLike(props.tokenId, comment.commentId, props.postChainId);
                } finally {
                  setActionInFlight({ id: null, action: null });
                }
              }}
              disabled={requiresNetworkSwitch || isBusy || comment.deleted}
              aria-busy={isLikeBusy}
              title={interactionDisabledTitle}
            >
              {isLikeBusy ? (
                <span className="spinner" aria-hidden="true" />
              ) : (
                <IconHeart size={14} filled={!!comment.likedByMe} />
              )}
              <span className="postActionCount">{likeCount}</span>
            </button>
            <button
              className={getStatButtonClass({
                requiresNetworkSwitch,
                active: comment.savedByMe ? "isActive isSaved" : ""
              })}
              type="button"
              onClick={async () => {
                setActionInFlight({ id: comment.commentId, action: "save" });
                try {
                  await props.onToggleCommentSave(props.tokenId, comment.commentId, props.postChainId);
                } finally {
                  setActionInFlight({ id: null, action: null });
                }
              }}
              disabled={requiresNetworkSwitch || isBusy || comment.deleted}
              aria-busy={isSaveBusy}
              title={interactionDisabledTitle}
            >
              {isSaveBusy ? (
                <span className="spinner" aria-hidden="true" />
              ) : (
                <IconBookmark size={14} filled={!!comment.savedByMe} />
              )}
              <span className="postActionCount">{saveCount}</span>
            </button>
            <button
              className={getStatButtonClass({ requiresNetworkSwitch })}
              type="button"
              onClick={() => {
                setActiveComposer((prev) => {
                  const isSame = prev.type === "reply" && prev.commentId === comment.commentId;
                  return isSame ? { type: null } : { type: "reply", commentId: comment.commentId };
                });
                setReplyDrafts((prev) => ({ ...prev, [comment.commentId]: prev[comment.commentId] ?? "" }));
              }}
              disabled={requiresNetworkSwitch || isBusy || comment.deleted}
            >
              <IconMessage size={14} />
              <span className="postActionCount">Reply</span>
            </button>
            <button
              className={getStatButtonClass({ requiresNetworkSwitch })}
              type="button"
              onClick={() => {
                setActiveComposer((prev) => {
                  const isSame = prev.type === "tip" && prev.commentId === comment.commentId;
                  return isSame ? { type: null } : { type: "tip", commentId: comment.commentId };
                });
                setTipDrafts((prev) => ({ ...prev, [comment.commentId]: prev[comment.commentId] ?? "" }));
              }}
              disabled={requiresNetworkSwitch || isBusy || comment.deleted}
            >
              <IconCoin size={14} />
              <span className="postActionCount">{nativeSymbol}</span>
            </button>
          </div>

          {activeComposer.type === "reply" && activeComposer.commentId === comment.commentId ? (
            <div className="postFormRow">
              <input
                className="postField"
                type="text"
                value={replyDrafts[comment.commentId] ?? ""}
                onChange={(event) =>
                  setReplyDrafts((prev) => ({ ...prev, [comment.commentId]: event.target.value }))
                }
                placeholder="Write a reply"
                disabled={isSigning || isBusy}
              />
              <button
                className="secondary buttonWithSpinner"
                type="button"
                onClick={async () => {
                  setActionInFlight({ id: comment.commentId, action: "reply" });
                  try {
                    const ok = await props.onReply(
                      props.tokenId,
                      comment.commentId,
                      replyDrafts[comment.commentId] ?? "",
                      props.postChainId
                    );
                    if (ok) {
                      setReplyDrafts((prev) => ({ ...prev, [comment.commentId]: "" }));
                      setActiveComposer({ type: null });
                    }
                  } finally {
                    setActionInFlight({ id: null, action: null });
                  }
                }}
                disabled={isSigning || isBusy}
                aria-busy={isReplyBusy}
              >
                {isReplyBusy ? <span className="spinner" aria-hidden="true" /> : null}
                Reply
              </button>
            </div>
          ) : null}

          {activeComposer.type === "edit" && activeComposer.commentId === comment.commentId ? (
            <div className="postFormRow">
              <input
                className="postField"
                type="text"
                value={editDrafts[comment.commentId] ?? ""}
                onChange={(event) =>
                  setEditDrafts((prev) => ({ ...prev, [comment.commentId]: event.target.value }))
                }
                placeholder="Edit your comment"
                disabled={isSigning || isBusy}
              />
              <button
                className="secondary buttonWithSpinner"
                type="button"
                onClick={async () => {
                  setActionInFlight({ id: comment.commentId, action: "edit" });
                  try {
                    const ok = await props.onEditComment(
                      props.tokenId,
                      comment.commentId,
                      editDrafts[comment.commentId] ?? "",
                      props.postChainId
                    );
                    if (ok) {
                      setActiveComposer({ type: null });
                    }
                  } finally {
                    setActionInFlight({ id: null, action: null });
                  }
                }}
                disabled={isSigning || isBusy}
                aria-busy={isEditBusy}
              >
                {isEditBusy ? <span className="spinner" aria-hidden="true" /> : null}
                Save
              </button>
            </div>
          ) : null}

          {activeComposer.type === "tip" && activeComposer.commentId === comment.commentId ? (
            <div className="postFormRow">
              <input
                className="postField"
                type="text"
                value={tipDrafts[comment.commentId] ?? ""}
                onChange={(event) =>
                  setTipDrafts((prev) => ({ ...prev, [comment.commentId]: event.target.value }))
                }
                placeholder={`Tip amount in ${nativeSymbol}`}
                disabled={isSigning || isBusy}
              />
              <button
                className="secondary buttonWithSpinner"
                type="button"
                onClick={async () => {
                  setActionInFlight({ id: comment.commentId, action: "tip" });
                  try {
                    const ok = await props.onTipComment(
                      props.tokenId,
                      comment.commentId,
                      tipDrafts[comment.commentId] ?? "",
                      props.postChainId
                    );
                    if (ok) {
                      setTipDrafts((prev) => ({ ...prev, [comment.commentId]: "" }));
                      setActiveComposer({ type: null });
                    }
                  } finally {
                    setActionInFlight({ id: null, action: null });
                  }
                }}
                disabled={isSigning || isBusy}
                aria-busy={isTipBusy}
              >
                {isTipBusy ? <span className="spinner" aria-hidden="true" /> : null}
                Tip
              </button>
            </div>
          ) : null}

          {activeComposer.type === "report" && activeComposer.commentId === comment.commentId ? (
            <div className="postFormRow">
              <input
                className="postField"
                type="text"
                value={reportDrafts[comment.commentId] ?? ""}
                onChange={(event) =>
                  setReportDrafts((prev) => ({ ...prev, [comment.commentId]: event.target.value }))
                }
                placeholder="Report reason"
                disabled={isSigning || isBusy}
              />
              <button
                className="secondary buttonWithSpinner"
                type="button"
                onClick={async () => {
                  setActionInFlight({ id: comment.commentId, action: "report" });
                  try {
                    const ok = await props.onReportComment(
                      props.tokenId,
                      comment.commentId,
                      reportDrafts[comment.commentId] ?? "",
                      props.postChainId
                    );
                    if (ok) {
                      setReportDrafts((prev) => ({ ...prev, [comment.commentId]: "" }));
                      setActiveComposer({ type: null });
                    }
                  } finally {
                    setActionInFlight({ id: null, action: null });
                  }
                }}
                disabled={isSigning || isBusy}
                aria-busy={isReportBusy}
              >
                {isReportBusy ? <span className="spinner" aria-hidden="true" /> : null}
                Report
              </button>
            </div>
          ) : null}
        </div>
      </>
    );
  };

  return (
    <section className={wrapperClassName}>
      {allowCommenting ? (
        <div className="postForm">
          <div className="postFormRow">
            <input
              className="postField"
              type="text"
              value={commentDraft}
              onChange={(event) => setCommentDraft(event.target.value)}
              placeholder="Write a comment to sign"
              disabled={isSigning}
              title={interactionDisabledTitle}
            />
            <button
              className={`secondary buttonWithSpinner${requiresNetworkSwitch ? " notAllowed" : ""}`}
              type="button"
              onClick={onSubmitComment}
              disabled={isSigning}
              title={interactionDisabledTitle}
            >
              {isSigning ? <span className="spinner" aria-hidden="true" /> : null}
              Sign
            </button>
          </div>
        </div>
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
                {renderComment(c)}
                {replies.length ? (
                  <div className="commentReplies">
                    {replies.map((reply, replyIdx) => (
                      <div
                        key={reply.commentId ?? `${reply.txHash ?? "nohash"}-${reply.logIndex ?? replyIdx}`}
                        className="commentReply"
                      >
                        {renderComment(reply, reply.parentId ? authorById.get(reply.parentId) ?? reply.parentId : null)}
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
