import type { Draft } from "@types";
import { MAX_POST_BODY_LENGTH } from "@shared/lib/postLimits";
import { useCallback, useState } from "react";
import type { CSSProperties } from "react";

export type PostCardEditBoxProps = {
  tokenId: string;
  postChainId?: string | null;

  avatarStyle?: CSSProperties;

  isMine: boolean;
  requiresNetworkSwitch: boolean;
  interactionDisabledTitle?: string;

  editDraft: Draft | null;
  isEditImageLoading: boolean;

  onSetEditDraft: (next: Draft) => void;
  onCancelEditPost: () => void;
  onSaveEditedPost: () => Promise<void>;
  onEditSelectFile: (file: File | null) => void;
  onEditClearImage: () => void;
  onFreezePost: (tokenId: string, postChainId?: string | null) => void;
};

export function PostCardEditBox(props: PostCardEditBoxProps) {
  const [isSaving, setIsSaving] = useState(false);

  const onSave = useCallback(async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      await props.onSaveEditedPost();
    } finally {
      setIsSaving(false);
    }
  }, [props, isSaving]);

  return (
    <div className="composer">
      <div className="composerHeader">
        <div className="avatar small" style={props.avatarStyle} />
        <div>
          <div className="composerTitle">Edit post</div>
          <div className="muted">Token #{props.tokenId}</div>
        </div>
      </div>
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
        <button
          className="primary buttonWithSpinner"
          type="button"
          onClick={onSave}
          disabled={props.requiresNetworkSwitch || props.isEditImageLoading || isSaving}
          title={props.interactionDisabledTitle}
        >
          {isSaving ? <span className="spinner" aria-hidden="true" /> : null}
          Save
        </button>
      </div>
    </div>
  );
}
