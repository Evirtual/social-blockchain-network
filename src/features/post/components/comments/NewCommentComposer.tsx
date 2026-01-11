type Props = {
  value: string;
  onChange: (next: string) => void;
  onSubmit: () => void;
  isSigning: boolean;
  requiresNetworkSwitch: boolean;
  interactionDisabledTitle?: string;
};

export function NewCommentComposer(props: Props) {
  const canSubmit = props.value.trim().length > 0 && !props.requiresNetworkSwitch && !props.isSigning;

  return (
    <div className="postForm commentComposer">
      <div className="postFormRow">
        <input
          className="postField"
          type="text"
          name="newComment"
          value={props.value}
          onChange={(event) => props.onChange(event.target.value)}
          placeholder="Write a comment to post"
          disabled={props.isSigning}
          title={props.interactionDisabledTitle}
        />
        <button
          className={`primary buttonWithSpinner${!canSubmit ? " notAllowed" : ""}`}
          type="button"
          onClick={props.onSubmit}
          disabled={!canSubmit}
          title={props.interactionDisabledTitle}
        >
          {props.isSigning ? <span className="spinner" aria-hidden="true" /> : null}
          Post
        </button>
      </div>
    </div>
  );
}
