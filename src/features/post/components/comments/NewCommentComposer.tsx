type Props = {
  value: string;
  onChange: (next: string) => void;
  onSubmit: () => void;
  isSigning: boolean;
  requiresNetworkSwitch: boolean;
  interactionDisabledTitle?: string;
};

export function NewCommentComposer(props: Props) {
  return (
    <div className="postForm commentComposer">
      <div className="postFormRow">
        <input
          className="postField"
          type="text"
          name="newComment"
          value={props.value}
          onChange={(event) => props.onChange(event.target.value)}
          placeholder="Write a comment to sign"
          disabled={props.isSigning}
          title={props.interactionDisabledTitle}
        />
        <button
          className={`secondary buttonWithSpinner${props.requiresNetworkSwitch ? " notAllowed" : ""}`}
          type="button"
          onClick={props.onSubmit}
          disabled={props.isSigning}
          title={props.interactionDisabledTitle}
        >
          {props.isSigning ? <span className="spinner" aria-hidden="true" /> : null}
          Sign
        </button>
      </div>
    </div>
  );
}
