import { useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { PostComment } from "@types";
import { Link } from "react-router-dom";
import { IconBookmark, IconCoin, IconHeart, IconMessage } from "@shared/components/icons";
import { getProfileUrl } from "@shared/lib/profile";
import { formatTipsWei } from "../postCard/footer/formatTips";
import { getStatButtonClass } from "../postCard/footer/getStatButtonClass";
import type { ActionInFlight, ActiveComposer } from "./types";
import { CommentComposerPanels } from "./CommentComposerPanels";
import { CommentDeleteModal } from "./CommentDeleteModal";
import { CommentHeader } from "./CommentHeader";
import { shortAddress, stableHueFromSeed } from "@shared/lib/format";
import { getExplorerTxUrl } from "@shared/lib/chain";
import type { PostActionsController } from "@features/post/types";

type Props = {
  comment: PostComment;
  defaultSupportBps: number;
  authorLabel: string;
  authorAvatarUrl?: string;
  replyToAddress?: string | null;
  replyToLabel?: string | null;
  tokenId: string;
  postChainId: string | null;
  explorerChainId: string | null;
  nativeSymbol: string;
  walletLower: string | null;
  canModerateComments?: boolean;
  requiresNetworkSwitch: boolean;
  interactionDisabledTitle?: string;
  isSigning: boolean;
  activeComposer: ActiveComposer;
  setActiveComposer: Dispatch<SetStateAction<ActiveComposer>>;
  replyDrafts: Record<string, string>;
  setReplyDrafts: Dispatch<SetStateAction<Record<string, string>>>;
  editDrafts: Record<string, string>;
  setEditDrafts: Dispatch<SetStateAction<Record<string, string>>>;
  tipDrafts: Record<string, string>;
  setTipDrafts: Dispatch<SetStateAction<Record<string, string>>>;
  tipSupportBpsDrafts: Record<string, number | null>;
  setTipSupportBpsDrafts: Dispatch<SetStateAction<Record<string, number | null>>>;
  tipSavePreferenceDrafts: Record<string, boolean>;
  setTipSavePreferenceDrafts: Dispatch<SetStateAction<Record<string, boolean>>>;
  reportDrafts: Record<string, string>;
  setReportDrafts: Dispatch<SetStateAction<Record<string, string>>>;
  actionInFlight: ActionInFlight;
  setActionInFlight: Dispatch<SetStateAction<ActionInFlight>>;

  postActions: PostActionsController;
};

export function CommentItem(props: Props) {
  const { comment } = props;
  const authorKey = comment.author.toLowerCase();
  const hue = stableHueFromSeed(authorKey);
  const explorer = comment.txHash ? getExplorerTxUrl(props.explorerChainId, comment.txHash) : null;
  const isMine = !!props.walletLower && comment.author.toLowerCase() === props.walletLower;
  const canEdit = isMine && !comment.deleted;
  const canDelete = (isMine || !!props.canModerateComments) && !comment.deleted;
  const isBusy = props.actionInFlight.id === comment.commentId;
  const likeCount = comment.likeCount ?? 0;
  const saveCount = comment.saveCount ?? 0;
  const isLikeBusy = isBusy && props.actionInFlight.action === "like";
  const isSaveBusy = isBusy && props.actionInFlight.action === "save";
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const isDeleteBusy = isBusy && props.actionInFlight.action === "delete";
  const isReportBusy = isBusy && props.actionInFlight.action === "report";

  const onOpenReport = () => {
    props.setActiveComposer({ type: "report", commentId: comment.commentId });
    props.setReportDrafts((prev) => ({ ...prev, [comment.commentId]: prev[comment.commentId] ?? "" }));
  };

  const onOpenEdit = () => {
    props.setActiveComposer({ type: "edit", commentId: comment.commentId });
    props.setEditDrafts((prev) => ({ ...prev, [comment.commentId]: comment.comment }));
  };

  // The icon only asks; nothing is deleted until the dialog confirms.
  const onRequestDelete = () => {
    if (isDeleteBusy) return;
    setIsDeleteConfirmOpen(true);
  };

  const onConfirmDelete = async () => {
    if (isDeleteBusy) return;
    props.setActionInFlight({ id: comment.commentId, action: "delete" });
    try {
      await props.postActions.deleteComment(props.tokenId, comment.commentId, props.postChainId);
      setIsDeleteConfirmOpen(false);
    } finally {
      props.setActionInFlight({ id: null, action: null });
    }
  };

  return (
    <>
      <CommentHeader
        comment={comment}
        label={props.authorLabel}
        hue={hue}
        avatarUrl={props.authorAvatarUrl}
        postChainId={props.postChainId}
        explorer={explorer}
        canEdit={canEdit}
        canDelete={canDelete}
        requiresNetworkSwitch={props.requiresNetworkSwitch}
        isBusy={isBusy}
        isReportBusy={isReportBusy}
        isDeleteBusy={isDeleteBusy}
        onOpenReport={onOpenReport}
        onOpenEdit={onOpenEdit}
        onDelete={onRequestDelete}
      />

      <div className="post-body">
        <div className="postText">
          <p className={comment.deleted ? "commentText isDeleted" : undefined}>
            {comment.deleted ? (
              "Comment deleted."
            ) : (
              <>
                {props.replyToAddress ? (
                  <Link className="commentReplyTo" to={getProfileUrl(props.postChainId, props.replyToAddress)}>
                    @{props.replyToLabel?.trim() ? props.replyToLabel : shortAddress(props.replyToAddress)}
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
              requiresNetworkSwitch: props.requiresNetworkSwitch,
              active: comment.likedByMe ? "isActive isLike" : ""
            })}
            type="button"
            onClick={async () => {
              props.setActionInFlight({ id: comment.commentId, action: "like" });
              try {
                await props.postActions.toggleCommentLike(props.tokenId, comment.commentId, props.postChainId);
              } finally {
                props.setActionInFlight({ id: null, action: null });
              }
            }}
            disabled={props.requiresNetworkSwitch || isBusy || comment.deleted}
            aria-busy={isLikeBusy}
            title={props.interactionDisabledTitle}
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
              requiresNetworkSwitch: props.requiresNetworkSwitch,
              active: comment.savedByMe ? "isActive isSaved" : ""
            })}
            type="button"
            onClick={async () => {
              props.setActionInFlight({ id: comment.commentId, action: "save" });
              try {
                await props.postActions.toggleCommentSave(props.tokenId, comment.commentId, props.postChainId);
              } finally {
                props.setActionInFlight({ id: null, action: null });
              }
            }}
            disabled={props.requiresNetworkSwitch || isBusy || comment.deleted}
            aria-busy={isSaveBusy}
            title={props.interactionDisabledTitle}
          >
            {isSaveBusy ? (
              <span className="spinner" aria-hidden="true" />
            ) : (
              <IconBookmark size={14} filled={!!comment.savedByMe} />
            )}
            <span className="postActionCount">{saveCount}</span>
          </button>
          <button
            className={getStatButtonClass({ requiresNetworkSwitch: props.requiresNetworkSwitch })}
            type="button"
            onClick={() => {
              props.setActiveComposer((prev) => {
                const isSame = prev.type === "reply" && prev.commentId === comment.commentId;
                return isSame ? { type: null } : { type: "reply", commentId: comment.commentId };
              });
              props.setReplyDrafts((prev) => ({ ...prev, [comment.commentId]: prev[comment.commentId] ?? "" }));
            }}
            disabled={props.requiresNetworkSwitch || isBusy || comment.deleted}
          >
            <IconMessage size={14} />
            <span className="postActionCount">Reply</span>
          </button>
          <button
            className={getStatButtonClass({ requiresNetworkSwitch: props.requiresNetworkSwitch })}
            type="button"
            onClick={() => {
              props.setActiveComposer((prev) => {
                const isSame = prev.type === "tip" && prev.commentId === comment.commentId;
                return isSame ? { type: null } : { type: "tip", commentId: comment.commentId };
              });
              props.setTipDrafts((prev) => ({ ...prev, [comment.commentId]: prev[comment.commentId] ?? "" }));

              props.setTipSupportBpsDrafts((prev) => {
                if (Object.prototype.hasOwnProperty.call(prev, comment.commentId)) return prev;
                const next = props.defaultSupportBps > 0 ? props.defaultSupportBps : null;
                return { ...prev, [comment.commentId]: next };
              });
              props.setTipSavePreferenceDrafts((prev) => {
                if (Object.prototype.hasOwnProperty.call(prev, comment.commentId)) return prev;
                return { ...prev, [comment.commentId]: false };
              });
            }}
            disabled={props.requiresNetworkSwitch || isBusy || comment.deleted}
          >
            <IconCoin size={14} />
            <span className="postActionCount">
              {formatTipsWei({ tipsWei: comment.tipWei ?? 0n, nativeSymbol: props.nativeSymbol })}
            </span>
          </button>
        </div>

        <CommentComposerPanels
          commentId={comment.commentId}
          tokenId={props.tokenId}
          postChainId={props.postChainId}
          nativeSymbol={props.nativeSymbol}
          originalComment={comment.comment}
          isSigning={props.isSigning}
          isBusy={isBusy}
          activeComposer={props.activeComposer}
          setActiveComposer={props.setActiveComposer}
          replyDraft={props.replyDrafts[comment.commentId] ?? ""}
          editDraft={props.editDrafts[comment.commentId] ?? ""}
          tipDraft={props.tipDrafts[comment.commentId] ?? ""}
          tipSupportBps={props.tipSupportBpsDrafts[comment.commentId] ?? null}
          onTipSupportBpsChange={(next) =>
            props.setTipSupportBpsDrafts((prev) => ({ ...prev, [comment.commentId]: next }))
          }
          tipSavePreference={props.tipSavePreferenceDrafts[comment.commentId] ?? false}
          onTipSavePreferenceChange={(next) =>
            props.setTipSavePreferenceDrafts((prev) => ({ ...prev, [comment.commentId]: next }))
          }
          reportDraft={props.reportDrafts[comment.commentId] ?? ""}
          setReplyDraft={(next) => props.setReplyDrafts((prev) => ({ ...prev, [comment.commentId]: next }))}
          setEditDraft={(next) => props.setEditDrafts((prev) => ({ ...prev, [comment.commentId]: next }))}
          setTipDraft={(next) => props.setTipDrafts((prev) => ({ ...prev, [comment.commentId]: next }))}
          setReportDraft={(next) => props.setReportDrafts((prev) => ({ ...prev, [comment.commentId]: next }))}
          actionInFlight={props.actionInFlight}
          setActionInFlight={props.setActionInFlight}
          onReply={props.postActions.replyToComment}
          onEditComment={props.postActions.editComment}
          onTipComment={props.postActions.tipComment}
          onReportComment={props.postActions.reportComment}
        />
      </div>

      <CommentDeleteModal
        open={isDeleteConfirmOpen}
        commentText={comment.comment}
        onConfirm={onConfirmDelete}
        onClose={() => setIsDeleteConfirmOpen(false)}
        isDeleting={isDeleteBusy}
        requiresNetworkSwitch={props.requiresNetworkSwitch}
        interactionDisabledTitle={props.interactionDisabledTitle}
      />
    </>
  );
}
