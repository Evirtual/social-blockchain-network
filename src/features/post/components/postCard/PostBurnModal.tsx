import { Modal } from "@shared/components/Modal";

type Props = {
  open: boolean;
  avatarStyle: React.CSSProperties;
  /** Shown so it is obvious which post is about to go. */
  postBody: string;
  onConfirm: () => void;
  onClose: () => void;
  isBurning: boolean;
  requiresNetworkSwitch: boolean;
  interactionDisabledTitle?: string;
};

/**
 * Burning is the only irreversible action in the app, and it was the only one
 * without a confirmation: the header icon called the contract directly, so a
 * mis-click destroyed a post permanently. Every other consequential action here
 * opens a dialog first, down to cropping an image.
 */
export function PostBurnModal(props: Props) {
  const preview = props.postBody.trim();

  return (
    <Modal
      open={props.open}
      title="Burn this post?"
      headerLeading={<div className="avatar small" style={props.avatarStyle} />}
      onClose={props.onClose}
    >
      <div className="postForm burnConfirm">
        <p className="burnConfirmWarning">
          This permanently destroys the post on chain. It cannot be undone, and its likes, comments and tips go
          with it.
        </p>

        {preview ? <blockquote className="burnConfirmPreview">{preview}</blockquote> : null}

        <div className="burnConfirmActions">
          <button className="secondary" type="button" onClick={props.onClose} disabled={props.isBurning}>
            Cancel
          </button>
          <button
            className="danger buttonWithSpinner"
            type="button"
            onClick={props.onConfirm}
            disabled={props.requiresNetworkSwitch || props.isBurning}
            title={props.interactionDisabledTitle}
          >
            {props.isBurning ? <span className="spinner" aria-hidden="true" /> : null}
            Burn post
          </button>
        </div>
      </div>
    </Modal>
  );
}
