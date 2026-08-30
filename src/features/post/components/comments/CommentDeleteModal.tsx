import { Modal } from "@shared/components/Modal";

type Props = {
  open: boolean;
  /** Shown so it is obvious which comment is about to go. */
  commentText: string;
  onConfirm: () => void;
  onClose: () => void;
  isDeleting: boolean;
  requiresNetworkSwitch: boolean;
  interactionDisabledTitle?: string;
};

/**
 * Deleting a comment is irreversible and was reachable in one click on a small
 * icon, with the wallet prompt as the only thing in the way. That prompt
 * confirms a transaction, not an intent: it shows a contract call rather than
 * what is about to be lost, and it is the kind of dialog people learn to click
 * through. Post burning already asks first; this matches it.
 */
export function CommentDeleteModal(props: Props) {
  const preview = props.commentText.trim();

  return (
    <Modal open={props.open} title="Delete this comment?" onClose={props.onClose}>
      <div className="postForm confirmDialog">
        <p className="confirmDialogWarning">
          This permanently deletes the comment on chain. It cannot be undone, and its likes, replies and tips go
          with it.
        </p>

        {preview ? <blockquote className="confirmDialogPreview">{preview}</blockquote> : null}

        <div className="confirmDialogActions">
          <button className="secondary" type="button" onClick={props.onClose} disabled={props.isDeleting}>
            Cancel
          </button>
          <button
            className="danger buttonWithSpinner"
            type="button"
            onClick={props.onConfirm}
            disabled={props.requiresNetworkSwitch || props.isDeleting}
            title={props.interactionDisabledTitle}
          >
            {props.isDeleting ? <span className="spinner" aria-hidden="true" /> : null}
            Delete comment
          </button>
        </div>
      </div>
    </Modal>
  );
}
