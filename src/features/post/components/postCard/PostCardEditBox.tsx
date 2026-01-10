import type { Draft } from "@types";
import { MAX_POST_BODY_LENGTH } from "@shared/lib/postLimits";
import { IconRepeat } from "@shared/components/icons";
import { useCallback, useState } from "react";

export type PostCardEditBoxProps = {
  tokenId: string;
  postChainId?: string | null;

  isMine: boolean;
  canModerate?: boolean;
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
      <textarea
        className="textarea"
        name="editPostBody"
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
        name="editPostMediaUrl"
        value={props.editDraft?.imageUrl ?? ""}
        onChange={(e) => {
          const v = e.target.value;
          const base = props.editDraft ?? { title: "", body: "", imageUrl: "", imageDataUrl: "" };
          props.onSetEditDraft({ ...base, imageUrl: v, imageDataUrl: "" });
        }}
        placeholder="Image URL"
      />

      <div className="row fileRow">
        <div className="fileInputWrap">
          <input
            className="file-input"
            type="file"
            name="editPostMediaUpload"
            accept="image/*,video/*"
            onChange={(e) => props.onEditSelectFile(e.target.files?.[0] ?? null)}
          />
          <button
            className="ghost iconButton fileInputAction"
            type="button"
            onClick={props.onEditClearImage}
            aria-label="Clear upload"
            title="Clear upload"
          >
            <IconRepeat size={16} />
          </button>
        </div>
      </div>

      {props.editDraft?.imageDataUrl?.startsWith("data:image/") && (
        <img className="image-preview" src={props.editDraft.imageDataUrl} alt="Edit preview" />
      )}

      {props.editDraft?.imageDataUrl?.startsWith("blob:") && (
        <video className="image-preview" src={props.editDraft.imageDataUrl} controls playsInline preload="metadata" />
      )}

      <div className="rowActions">
        {props.isMine || props.canModerate ? (
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
