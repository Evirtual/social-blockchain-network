import type { Dispatch, SetStateAction } from "react";
import type { ActionInFlight, ActiveComposer } from "./types";

type Props = {
  commentId: string;
  tokenId: string;
  postChainId: string | null;
  nativeSymbol: string;
  originalComment: string;
  isSigning: boolean;
  isBusy: boolean;
  activeComposer: ActiveComposer;
  setActiveComposer: Dispatch<SetStateAction<ActiveComposer>>;
  replyDraft: string;
  editDraft: string;
  tipDraft: string;
  reportDraft: string;
  setReplyDraft: (next: string) => void;
  setEditDraft: (next: string) => void;
  setTipDraft: (next: string) => void;
  setReportDraft: (next: string) => void;
  actionInFlight: ActionInFlight;
  setActionInFlight: Dispatch<SetStateAction<ActionInFlight>>;
  onReply: (tokenId: string, parentCommentId: string, comment: string, postChainId?: string | null) => Promise<boolean>;
  onEditComment: (tokenId: string, commentId: string, comment: string, postChainId?: string | null) => Promise<boolean>;
  onTipComment: (tokenId: string, commentId: string, amountRaw: string, postChainId?: string | null) => Promise<boolean>;
  onReportComment: (tokenId: string, commentId: string, reason: string, postChainId?: string | null) => Promise<boolean>;
};

export function CommentComposerPanels(props: Props) {
  const isReplyBusy = props.actionInFlight.id === props.commentId && props.actionInFlight.action === "reply";
  const isEditBusy = props.actionInFlight.id === props.commentId && props.actionInFlight.action === "edit";
  const isTipBusy = props.actionInFlight.id === props.commentId && props.actionInFlight.action === "tip";
  const isReportBusy = props.actionInFlight.id === props.commentId && props.actionInFlight.action === "report";
  const replyTrimmed = props.replyDraft.trim();
  const editTrimmed = props.editDraft.trim();
  const reportTrimmed = props.reportDraft.trim();
  const tipValue = Number(props.tipDraft);
  const canReply = replyTrimmed.length > 0 && !props.isSigning && !props.isBusy;
  const canEdit =
    editTrimmed.length > 0 && editTrimmed !== props.originalComment.trim() && !props.isSigning && !props.isBusy;
  const canTip = Number.isFinite(tipValue) && tipValue > 0 && !props.isSigning && !props.isBusy;
  const canReport = reportTrimmed.length > 0 && !props.isSigning && !props.isBusy;

  return (
    <>
      {props.activeComposer.type === "reply" && props.activeComposer.commentId === props.commentId ? (
        <div className="postFormRow">
          <input
            className="postField"
            type="text"
            name="commentReply"
            value={props.replyDraft}
            onChange={(event) => props.setReplyDraft(event.target.value)}
            placeholder="Write a reply"
            disabled={props.isSigning || props.isBusy}
          />
          <button
            className={`primary buttonWithSpinner${!canReply ? " notAllowed" : ""}`}
            type="button"
            onClick={async () => {
              props.setActionInFlight({ id: props.commentId, action: "reply" });
              try {
                const ok = await props.onReply(props.tokenId, props.commentId, props.replyDraft, props.postChainId);
                if (ok) {
                  props.setReplyDraft("");
                  props.setActiveComposer({ type: null });
                }
              } finally {
                props.setActionInFlight({ id: null, action: null });
              }
            }}
            disabled={!canReply}
            aria-busy={isReplyBusy}
          >
            {isReplyBusy ? <span className="spinner" aria-hidden="true" /> : null}
            Reply
          </button>
        </div>
      ) : null}

      {props.activeComposer.type === "edit" && props.activeComposer.commentId === props.commentId ? (
        <div className="postFormRow">
          <input
            className="postField"
            type="text"
            name="commentEdit"
            value={props.editDraft}
            onChange={(event) => props.setEditDraft(event.target.value)}
            placeholder="Edit your comment"
            disabled={props.isSigning || props.isBusy}
          />
          <button
            className={`secondary buttonWithSpinner${!canEdit ? " notAllowed" : ""}`}
            type="button"
            onClick={async () => {
              props.setActionInFlight({ id: props.commentId, action: "edit" });
              try {
                const ok = await props.onEditComment(props.tokenId, props.commentId, props.editDraft, props.postChainId);
                if (ok) {
                  props.setActiveComposer({ type: null });
                }
              } finally {
                props.setActionInFlight({ id: null, action: null });
              }
            }}
            disabled={!canEdit}
            aria-busy={isEditBusy}
          >
            {isEditBusy ? <span className="spinner" aria-hidden="true" /> : null}
            Save
          </button>
        </div>
      ) : null}

      {props.activeComposer.type === "tip" && props.activeComposer.commentId === props.commentId ? (
        <div className="postFormRow">
          <input
            className="postField"
            type="text"
            name="commentTipAmount"
            value={props.tipDraft}
            onChange={(event) => props.setTipDraft(event.target.value)}
            placeholder={`Tip amount in ${props.nativeSymbol}`}
            disabled={props.isSigning || props.isBusy}
          />
          <button
            className={`primary buttonWithSpinner${!canTip ? " notAllowed" : ""}`}
            type="button"
            onClick={async () => {
              props.setActionInFlight({ id: props.commentId, action: "tip" });
              try {
                const ok = await props.onTipComment(props.tokenId, props.commentId, props.tipDraft, props.postChainId);
                if (ok) {
                  props.setTipDraft("");
                  props.setActiveComposer({ type: null });
                }
              } finally {
                props.setActionInFlight({ id: null, action: null });
              }
            }}
            disabled={!canTip}
            aria-busy={isTipBusy}
          >
            {isTipBusy ? <span className="spinner" aria-hidden="true" /> : null}
            Tip
          </button>
        </div>
      ) : null}

      {props.activeComposer.type === "report" && props.activeComposer.commentId === props.commentId ? (
        <div className="postFormRow">
          <input
            className="postField"
            type="text"
            name="commentReportReason"
            value={props.reportDraft}
            onChange={(event) => props.setReportDraft(event.target.value)}
            placeholder="Report reason"
            disabled={props.isSigning || props.isBusy}
          />
          <button
            className={`secondary buttonWithSpinner${!canReport ? " notAllowed" : ""}`}
            type="button"
            onClick={async () => {
              props.setActionInFlight({ id: props.commentId, action: "report" });
              try {
                const ok = await props.onReportComment(
                  props.tokenId,
                  props.commentId,
                  props.reportDraft,
                  props.postChainId
                );
                if (ok) {
                  props.setReportDraft("");
                  props.setActiveComposer({ type: null });
                }
              } finally {
                props.setActionInFlight({ id: null, action: null });
              }
            }}
            disabled={!canReport}
            aria-busy={isReportBusy}
          >
            {isReportBusy ? <span className="spinner" aria-hidden="true" /> : null}
            Report
          </button>
        </div>
      ) : null}
    </>
  );
}
