import type { CSSProperties } from "react";
import { Modal } from "@shared/components/Modal";

type Props = {
  open: boolean;
  avatarStyle?: CSSProperties;
  tipDraft: string;
  onTipDraftChange: (next: string) => void;
  nativeSymbol: string;
  onSubmitTip: () => void;
  onClose: () => void;
  requiresNetworkSwitch: boolean;
  inFlight: string | null;
  interactionDisabledTitle?: string;
};

export function PostTipModal(props: Props) {
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
            onChange={(event) => props.onTipDraftChange(event.target.value)}
            placeholder={`Tip amount in ${props.nativeSymbol} (e.g. 0.001)`}
            disabled={props.requiresNetworkSwitch || props.inFlight === "tip"}
          />
          <button
            className={"secondary buttonWithSpinner"}
            type="button"
            onClick={props.onSubmitTip}
            disabled={props.requiresNetworkSwitch || props.inFlight === "tip"}
            title={props.interactionDisabledTitle}
          >
            {props.inFlight === "tip" ? <span className="spinner" aria-hidden="true" /> : null}
            Tip
          </button>
        </div>
      </div>
    </Modal>
  );
}
