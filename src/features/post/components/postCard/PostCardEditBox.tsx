import type { Draft } from "@types";
import { MAX_POST_BODY_LENGTH } from "@shared/lib/postLimits";

export type PostCardEditBoxProps = {
  tokenId: string;
  postChainId?: string | null;

  isMine: boolean;
  requiresNetworkSwitch: boolean;
  interactionDisabledTitle?: string;

  editDraft: Draft | null;
  isEditImageLoading: boolean;

  onSetEditDraft: (next: Draft) => void;
  onCancelEditPost: () => void;
  onSaveEditedPost: () => void;
  onEditSelectFile: (file: File | null) => void;
  onEditClearImage: () => void;
  onFreezePost: (tokenId: string, postChainId?: string | null) => void;
};

export function PostCardEditBox(props: PostCardEditBoxProps) {
  return (
    <div className="editBox">
      <textarea
        className="textarea"
        rows={4}
        value={props.editDraft?.body ?? ""}
        maxLength={MAX_POST_BODY_LENGTH}
        onChange={(e) => {
          const nextBody = e.target.value.slice(0, MAX_POST_BODY_LENGTH);
          const base = props.editDraft ?? { title: "", body: "", imageUrl: "", imageDataUrl: "" };
          props.onSetEditDraft({ ...base, body: nextBody });
        }}
        placeholder="Post text"
      />
      <div className="muted">
        {(props.editDraft?.body ?? "").length}/{MAX_POST_BODY_LENGTH}
      </div>
      <input
        className="input"
        value={props.editDraft?.imageUrl ?? ""}
        onChange={(e) => {
          const v = e.target.value;
          const base = props.editDraft ?? { title: "", body: "", imageUrl: "", imageDataUrl: "" };
          props.onSetEditDraft({ ...base, imageUrl: v, imageDataUrl: "" });
        }}
        placeholder="Image URL"
      />

      <div className="row fileRow">
        <input
          className="file-input"
          type="file"
          accept="image/*,video/*"
          onChange={(e) => props.onEditSelectFile(e.target.files?.[0] ?? null)}
        />
        <button className="secondary" type="button" onClick={props.onEditClearImage}>
          Clear
        </button>
      </div>

      {props.editDraft?.imageDataUrl?.startsWith("data:image/") && (
        <img className="image-preview" src={props.editDraft.imageDataUrl} alt="Edit preview" />
      )}

      {props.editDraft?.imageDataUrl?.startsWith("blob:") && (
        <video className="image-preview" src={props.editDraft.imageDataUrl} controls playsInline preload="metadata" />
      )}

      <div className="rowActions">
        {props.isMine ? (
          <button
            className="danger"
            type="button"
            onClick={() => props.onFreezePost(props.tokenId, props.postChainId)}
            disabled={props.requiresNetworkSwitch}
            title={props.interactionDisabledTitle}
          >
            Freeze
          </button>
        ) : null}
        <button className="secondary" type="button" onClick={props.onCancelEditPost}>
          Cancel
        </button>
        <button className="primary" type="button" onClick={props.onSaveEditedPost} disabled={props.isEditImageLoading}>
          Save
        </button>
      </div>
    </div>
  );
}
