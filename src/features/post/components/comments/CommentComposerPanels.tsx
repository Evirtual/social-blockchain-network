import { useEffect, useId, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import type { ActionInFlight, ActiveComposer } from "./types";
import { IconCheck, IconQuestion } from "@shared/components/icons";
import { parseEther } from "ethers";
import { parseTipAmountRaw } from "@features/social/services/postActions/tipAmount";
import { formatTipsWei } from "../postCard/footer";

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
  tipSupportBps: number | null;
  onTipSupportBpsChange: (next: number | null) => void;
  tipSavePreference: boolean;
  onTipSavePreferenceChange: (next: boolean) => void;
  reportDraft: string;
  setReplyDraft: (next: string) => void;
  setEditDraft: (next: string) => void;
  setTipDraft: (next: string) => void;
  setReportDraft: (next: string) => void;
  actionInFlight: ActionInFlight;
  setActionInFlight: Dispatch<SetStateAction<ActionInFlight>>;
  onReply: (tokenId: string, parentCommentId: string, comment: string, postChainId?: string | null) => Promise<boolean>;
  onEditComment: (tokenId: string, commentId: string, comment: string, postChainId?: string | null) => Promise<boolean>;
  onTipComment: (
    tokenId: string,
    commentId: string,
    amountRaw: string,
    postChainId?: string | null,
    supportBps?: number | null,
    savePreference?: boolean
  ) => Promise<boolean>;
  onReportComment: (tokenId: string, commentId: string, reason: string, postChainId?: string | null) => Promise<boolean>;
};

export function CommentComposerPanels(props: Props) {
  const sanitizeTipDraft = (nextRaw: string) => {
    const raw = (nextRaw ?? "").trim().replace(/,/g, ".");
    if (!raw) return "";

    let out = raw.replace(/[^0-9.]/g, "");
    const firstDot = out.indexOf(".");
    if (firstDot !== -1) {
      out = out.slice(0, firstDot + 1) + out.slice(firstDot + 1).replace(/\./g, "");
    }
    if (out.startsWith(".")) out = `0${out}`;

    const [i, f] = out.split(".");
    if (typeof f === "string") {
      return `${i}.${f.slice(0, 18)}`;
    }
    return out;
  };

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

  const supportOptions = [1, 3, 5, 10];
  const supportDisabled = props.isSigning || props.isBusy;

  const [isSupportHelpOpen, setIsSupportHelpOpen] = useState(false);
  const tooltipId = useId();

  const splitPreview = useMemo(() => {
    if (!props.tipSupportBps) return null;
    const parsed = parseTipAmountRaw(props.tipDraft);
    if (!parsed.ok) return null;
    try {
      const totalWei = parseEther(parsed.raw);
      if (totalWei <= 0n) return null;
      const protocolWei = (totalWei * BigInt(props.tipSupportBps)) / 10000n;
      const authorWei = totalWei - protocolWei;
      return {
        authorText: formatTipsWei({ tipsWei: authorWei, nativeSymbol: props.nativeSymbol }),
        protocolText: formatTipsWei({ tipsWei: protocolWei, nativeSymbol: props.nativeSymbol })
      };
    } catch {
      return null;
    }
  }, [props.tipSupportBps, props.tipDraft, props.nativeSymbol]);

  useEffect(() => {
    if (props.activeComposer.type !== "tip" || props.activeComposer.commentId !== props.commentId) {
      setIsSupportHelpOpen(false);
    }
  }, [props.activeComposer, props.commentId]);

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
        <>
          <div className="postFormRow">
            <input
              className="postField"
              type="text"
              name="commentTipAmount"
              value={props.tipDraft}
              onChange={(event) => props.setTipDraft(sanitizeTipDraft(event.target.value))}
              placeholder={`Tip amount in ${props.nativeSymbol} (e.g. 0.001)`}
              disabled={props.isSigning || props.isBusy}
              inputMode="decimal"
              autoComplete="off"
            />
            <button
              className={`primary buttonWithSpinner${!canTip ? " notAllowed" : ""}`}
              type="button"
              onClick={async () => {
                props.setActionInFlight({ id: props.commentId, action: "tip" });
                try {
                  const ok = await props.onTipComment(
                    props.tokenId,
                    props.commentId,
                    props.tipDraft,
                    props.postChainId,
                    props.tipSupportBps,
                    props.tipSavePreference
                  );
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

          <div className="tipSupport" aria-label="Protocol support">
            <div className="tipSupportHeader">
              <div className="tipSupportLabel">Support protocol</div>
              <button
                type="button"
                className="iconButton ghost tipSupportHelp"
                aria-label="About protocol support"
                aria-expanded={isSupportHelpOpen}
                aria-controls={tooltipId}
                onClick={() => setIsSupportHelpOpen((prev) => !prev)}
                disabled={supportDisabled}
              >
                <IconQuestion size={18} />
              </button>
            </div>

            <div
              id={tooltipId}
              className={`tipSupportDropdown${isSupportHelpOpen ? " isOpen" : ""}`}
              aria-hidden={!isSupportHelpOpen}
            >
              <div className="tipSupportDropdownTitle">How it works</div>
              <div className="tipSupportDropdownText">
                Normally, your tip goes to the author. If you pick a support %, that slice goes to the protocol treasury
                and the rest goes to the author.
              </div>
            </div>

            <div className="tipSupportOptions">
              {supportOptions.map((pct) => {
                const bps = pct * 100;
                const isActive = props.tipSupportBps === bps;
                return (
                  <button
                    key={pct}
                    type="button"
                    className={`pill pillButton${isActive ? " isActive" : ""}`}
                    disabled={supportDisabled}
                    onClick={() => {
                      const next = isActive ? null : bps;
                      props.onTipSupportBpsChange(next);
                      if (!next) props.onTipSavePreferenceChange(false);
                    }}
                    title={`Support protocol with ${pct}%`}
                  >
                    {pct}%
                  </button>
                );
              })}
            </div>

            {splitPreview ? (
              <div className="tipSupportSummary" aria-label="Tip split">
                <div className="tipSupportSummaryRow">
                  <span className="muted">To author:</span>
                  <span className="tipSupportSummaryValue">{splitPreview.authorText}</span>
                </div>
                <div className="tipSupportSummaryRow">
                  <span className="muted">To protocol:</span>
                  <span className="tipSupportSummaryValue">{splitPreview.protocolText}</span>
                </div>
              </div>
            ) : null}

            {props.tipSupportBps ? (
              <button
                type="button"
                className={`pill pillButton tipSupportSaveButton${props.tipSavePreference ? " isActive" : ""}`}
                disabled={supportDisabled}
                onClick={() => props.onTipSavePreferenceChange(!props.tipSavePreference)}
                title="Use this % as your default"
              >
                <span className="pillIcon" aria-hidden="true">
                  <IconCheck size={16} />
                </span>
                Save as default
              </button>
            ) : null}
          </div>
        </>
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
