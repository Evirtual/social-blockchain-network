import { Modal } from "@shared/components/Modal";

type Props = {
  open: boolean;
  avatarStyle: React.CSSProperties;
  reportDraft: string;
  onReportDraftChange: (next: string) => void;
  onSubmit: () => void;
  onClose: () => void;
  isReporting: boolean;
  requiresNetworkSwitch: boolean;
  interactionDisabledTitle?: string;
};

export function PostReportModal(props: Props) {
  return (
    <Modal open={props.open} title="Report post" headerLeading={<div className="avatar small" style={props.avatarStyle} />} onClose={props.onClose}>
      <div className="postForm">
        <div className="postFormRow">
          <input
            className="postField"
            type="text"
            value={props.reportDraft}
            onChange={(event) => props.onReportDraftChange(event.target.value)}
            placeholder="Report reason"
            disabled={props.isReporting}
          />
          <button
            className={"secondary buttonWithSpinner"}
            type="button"
            onClick={props.onSubmit}
            disabled={props.requiresNetworkSwitch || props.isReporting}
            title={props.interactionDisabledTitle}
          >
            {props.isReporting ? <span className="spinner" aria-hidden="true" /> : null}
            Report
          </button>
        </div>
      </div>
    </Modal>
  );
}
