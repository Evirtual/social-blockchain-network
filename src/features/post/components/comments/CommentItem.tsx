import type { Dispatch, SetStateAction } from "react";
import type { PostComment } from "@types";
import { Link } from "react-router-dom";
import { IconBookmark, IconCoin, IconHeart, IconMessage } from "@shared/components/icons";
import { getStatButtonClass } from "../postCard/footer";
import type { ActionInFlight, ActiveComposer } from "./types";
import { CommentComposerPanels } from "./CommentComposerPanels";
import { CommentHeader } from "./CommentHeader";

type Props = {
  comment: PostComment;
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
  reportDrafts: Record<string, string>;
  setReportDrafts: Dispatch<SetStateAction<Record<string, string>>>;
  actionInFlight: ActionInFlight;
  setActionInFlight: Dispatch<SetStateAction<ActionInFlight>>;
  onReply: (tokenId: string, parentCommentId: string, comment: string, postChainId?: string | null) => Promise<boolean>;
  onEditComment: (tokenId: string, commentId: string, comment: string, postChainId?: string | null) => Promise<boolean>;
  onDeleteComment: (tokenId: string, commentId: string, postChainId?: string | null) => Promise<boolean>;
  onToggleCommentLike: (tokenId: string, commentId: string, postChainId?: string | null) => Promise<boolean>;
  onToggleCommentSave: (tokenId: string, commentId: string, postChainId?: string | null) => Promise<boolean>;
  onTipComment: (tokenId: string, commentId: string, amountRaw: string, postChainId?: string | null) => Promise<boolean>;
  onReportComment: (tokenId: string, commentId: string, reason: string, postChainId?: string | null) => Promise<boolean>;
  shortAddress: (address: string) => string;
  stableHueFromSeed: (seed: string) => number;
  getExplorerTxUrl: (chainId: string | null, txHash: string) => string | null;
};

export function CommentItem(props: Props) {
  const { comment } = props;
  const authorKey = comment.author.toLowerCase();
  const hue = props.stableHueFromSeed(authorKey);
  const explorer = comment.txHash ? props.getExplorerTxUrl(props.explorerChainId, comment.txHash) : null;
  const isMine = !!props.walletLower && comment.author.toLowerCase() === props.walletLower;
  const canEdit = isMine && !comment.deleted;
  const canDelete = (isMine || !!props.canModerateComments) && !comment.deleted;
  const isBusy = props.actionInFlight.id === comment.commentId;
  const likeCount = comment.likeCount ?? 0;
  const saveCount = comment.saveCount ?? 0;
  const isLikeBusy = isBusy && props.actionInFlight.action === "like";
  const isSaveBusy = isBusy && props.actionInFlight.action === "save";
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

  const onDelete = async () => {
    props.setActionInFlight({ id: comment.commentId, action: "delete" });
    try {
      await props.onDeleteComment(props.tokenId, comment.commentId, props.postChainId);
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
        explorer={explorer}
        canEdit={canEdit}
        canDelete={canDelete}
        requiresNetworkSwitch={props.requiresNetworkSwitch}
        isBusy={isBusy}
        isReportBusy={isReportBusy}
        isDeleteBusy={isDeleteBusy}
        onOpenReport={onOpenReport}
        onOpenEdit={onOpenEdit}
        onDelete={onDelete}
      />

      <div className="post-body">
        <div className="postText">
          <p className={comment.deleted ? "commentText isDeleted" : undefined}>
            {comment.deleted ? (
              "Comment deleted."
            ) : (
              <>
                {props.replyToAddress ? (
                  <Link className="commentReplyTo" to={`/profile/${props.replyToAddress}`}>
                    @{props.replyToLabel?.trim() ? props.replyToLabel : props.shortAddress(props.replyToAddress)}
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
                await props.onToggleCommentLike(props.tokenId, comment.commentId, props.postChainId);
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
                await props.onToggleCommentSave(props.tokenId, comment.commentId, props.postChainId);
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
            }}
            disabled={props.requiresNetworkSwitch || isBusy || comment.deleted}
          >
            <IconCoin size={14} />
            <span className="postActionCount">{props.nativeSymbol}</span>
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
          reportDraft={props.reportDrafts[comment.commentId] ?? ""}
          setReplyDraft={(next) => props.setReplyDrafts((prev) => ({ ...prev, [comment.commentId]: next }))}
          setEditDraft={(next) => props.setEditDrafts((prev) => ({ ...prev, [comment.commentId]: next }))}
          setTipDraft={(next) => props.setTipDrafts((prev) => ({ ...prev, [comment.commentId]: next }))}
          setReportDraft={(next) => props.setReportDrafts((prev) => ({ ...prev, [comment.commentId]: next }))}
          actionInFlight={props.actionInFlight}
          setActionInFlight={props.setActionInFlight}
          onReply={props.onReply}
          onEditComment={props.onEditComment}
          onTipComment={props.onTipComment}
          onReportComment={props.onReportComment}
        />
      </div>
    </>
  );
}
