import { useEffect, useId, useMemo, useState, type CSSProperties } from "react";
import { Modal } from "@shared/components/Modal";
import { IconQuestion } from "@shared/components/icons";
import { IconCheck } from "@shared/components/icons";
import { parseEther } from "ethers";
import { parseTipAmountRaw } from "@features/social/services/postActions/tipAmount";
import { formatTipsWei } from "./formatTips";

type Props = {
  open: boolean;
  avatarStyle?: CSSProperties;
  tipDraft: string;
  onTipDraftChange: (next: string) => void;
  nativeSymbol: string;
  supportBps: number | null;
  onSupportBpsChange: (next: number | null) => void;
  savePreference: boolean;
  onSavePreferenceChange: (next: boolean) => void;
  onSubmitTip: () => void;
  /** Why the last attempt was rejected, shown in the dialog rather than the sidebar. */
  tipError?: string;
  onClose: () => void;
  requiresNetworkSwitch: boolean;
  inFlight: string | null;
  interactionDisabledTitle?: string;
};

export function PostTipModal(props: Props) {
  const sanitizeTipDraft = (nextRaw: string) => {
    const raw = (nextRaw ?? "").trim().replace(/,/g, ".");
    if (!raw) return "";

    // Keep only digits and a single decimal point. No negatives.
    let out = raw.replace(/[^0-9.]/g, "");
    const firstDot = out.indexOf(".");
    if (firstDot !== -1) {
      out = out.slice(0, firstDot + 1) + out.slice(firstDot + 1).replace(/\./g, "");
    }
    if (out.startsWith(".")) out = `0${out}`;

    // Clamp to 18 decimals to match parseEther.
    const [i, f] = out.split(".");
    if (typeof f === "string") {
      return `${i}.${f.slice(0, 18)}`;
    }
    return out;
  };

  const tipValue = Number(props.tipDraft);
  const canTip =
    Number.isFinite(tipValue) &&
    tipValue > 0 &&
    !props.requiresNetworkSwitch &&
    props.inFlight !== "tip";

  const supportOptions = [1, 3, 5, 10];
  const supportDisabled = props.requiresNetworkSwitch || props.inFlight === "tip";

  const [isSupportHelpOpen, setIsSupportHelpOpen] = useState(false);
  const tooltipId = useId();

  const splitPreview = useMemo(() => {
    if (!props.supportBps) return null;
    const parsed = parseTipAmountRaw(props.tipDraft);
    if (!parsed.ok) return null;
    try {
      const totalWei = parseEther(parsed.raw);
      if (totalWei <= 0n) return null;
      const protocolWei = (totalWei * BigInt(props.supportBps)) / 10000n;
      const authorWei = totalWei - protocolWei;
      return {
        authorText: formatTipsWei({ tipsWei: authorWei, nativeSymbol: props.nativeSymbol }),
        protocolText: formatTipsWei({ tipsWei: protocolWei, nativeSymbol: props.nativeSymbol })
      };
    } catch {
      return null;
    }
  }, [props.supportBps, props.tipDraft, props.nativeSymbol]);

  useEffect(() => {
    if (!props.open) setIsSupportHelpOpen(false);
  }, [props.open]);

  return (
    <Modal
      open={props.open}
      title="Tip"
      headerLeading={<div className="avatar small" style={props.avatarStyle} />}
      onClose={props.onClose}
    >
      <div className="postForm">
        <div className="postFormRow">
          <input
            className="postField"
            type="text"
            name="postTipAmount"
            value={props.tipDraft}
            onChange={(event) => props.onTipDraftChange(sanitizeTipDraft(event.target.value))}
            placeholder={`Tip amount in ${props.nativeSymbol} (e.g. 0.001)`}
            disabled={props.requiresNetworkSwitch || props.inFlight === "tip"}
            inputMode="decimal"
            autoComplete="off"
          />
          <button
            className={`primary buttonWithSpinner${!canTip ? " notAllowed" : ""}`}
            type="button"
            onClick={props.onSubmitTip}
            disabled={!canTip}
            title={props.interactionDisabledTitle}
          >
            {props.inFlight === "tip" ? <span className="spinner" aria-hidden="true" /> : null}
            Tip
          </button>
        </div>

        {props.tipError ? (
          <div className="tipError" role="alert">
            {props.tipError}
          </div>
        ) : null}

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
              const isActive = props.supportBps === bps;
              return (
                <button
                  key={pct}
                  type="button"
                  className={`pill pillButton${isActive ? " isActive" : ""}`}
                  disabled={supportDisabled}
                  onClick={() => props.onSupportBpsChange(isActive ? null : bps)}
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

          {props.supportBps ? (
            <button
              type="button"
              className={`pill pillButton tipSupportSaveButton${props.savePreference ? " isActive" : ""}`}
              disabled={supportDisabled}
              onClick={() => props.onSavePreferenceChange(!props.savePreference)}
              title="Use this % as your default"
            >
              <span className="pillIcon" aria-hidden="true">
                <IconCheck size={16} />
              </span>
              Save as default
            </button>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}
