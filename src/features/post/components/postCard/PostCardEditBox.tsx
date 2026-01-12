import type { Draft } from "@types";
import { MAX_POST_BODY_LENGTH } from "@shared/lib/postLimits";
import { IconPlus, IconX } from "@shared/components/icons";
import { ipfsToHttp } from "@features/ipfs";
import { useCallback, useRef, useState } from "react";

export type PostCardEditBoxProps = {
  tokenId: string;
  postChainId?: string | null;
  existingIsVideo?: boolean;
  originalBody?: string | null;
  originalMediaUrl?: string | null;

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
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [hasFileSelected, setHasFileSelected] = useState(false);

  const onSave = useCallback(async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      await props.onSaveEditedPost();
    } finally {
      setIsSaving(false);
    }
  }, [props, isSaving]);

  const handleClearUpload = useCallback(() => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.dataset.hasFile = "false";
    }
    setHasFileSelected(false);
    props.onEditClearImage();
  }, [props]);

  const originalBody = (props.originalBody ?? "").trim();
  const originalMediaUrl = (props.originalMediaUrl ?? "").trim();
  const existingUrl = (props.editDraft?.imageUrl ?? "").trim();
  const existingHttpUrl = existingUrl ? ipfsToHttp(existingUrl) : "";
  const existingLower = existingUrl.toLowerCase();
  const isExistingVideo =
    props.existingIsVideo ??
    (existingLower.endsWith(".mp4") || existingLower.endsWith(".webm") || existingLower.endsWith(".ogg"));
  const hasMedia = Boolean(props.editDraft?.imageDataUrl) || Boolean(existingHttpUrl) || hasFileSelected;
  const bodyTrimmed = (props.editDraft?.body ?? "").trim();
  const hasContent = bodyTrimmed.length > 0 || Boolean(existingUrl) || Boolean(props.editDraft?.imageDataUrl);
  const hasChanges =
    bodyTrimmed !== originalBody ||
    Boolean(props.editDraft?.imageDataUrl) ||
    existingUrl !== originalMediaUrl;
  const disableSave = !hasContent || !hasChanges || props.requiresNetworkSwitch || props.isEditImageLoading || isSaving;

  return (
    <div className="composer">
      <input
        className="file-input file-input-hidden"
        type="file"
        name="editPostMediaUpload"
        id={`editPostMediaUpload-${props.tokenId}`}
        accept="image/heic,image/heif,image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/ogg"
        data-has-file="false"
        ref={fileInputRef}
        onChange={(e) => {
          const input = e.currentTarget;
          const hasFile = (input.files?.length ?? 0) > 0;
          input.dataset.hasFile = hasFile ? "true" : "false";
          setHasFileSelected(hasFile);
          props.onEditSelectFile(input.files?.[0] ?? null);
        }}
      />

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

      {props.editDraft?.imageDataUrl?.startsWith("data:image/") ? (
        <div className="mediaPreview">
          <img className="image-preview" src={props.editDraft.imageDataUrl} alt="Edit preview" />
          <button
            className="ghost iconButton mediaPreviewClear"
            type="button"
            onClick={handleClearUpload}
            aria-label="Remove media"
            title="Remove media"
          >
            <IconX size={16} />
          </button>
        </div>
      ) : props.editDraft?.imageDataUrl?.startsWith("blob:") ? (
        <div className="mediaPreview">
          <video className="image-preview" src={props.editDraft.imageDataUrl} controls playsInline preload="metadata" />
          <button
            className="ghost iconButton mediaPreviewClear"
            type="button"
            onClick={handleClearUpload}
            aria-label="Remove media"
            title="Remove media"
          >
            <IconX size={16} />
          </button>
        </div>
      ) : existingHttpUrl ? (
        <div className="mediaPreview">
          {isExistingVideo ? (
            <video className="image-preview" src={existingHttpUrl} controls playsInline preload="metadata" />
          ) : (
            <img className="image-preview" src={existingHttpUrl} alt="Current media" />
          )}
          <button
            className="ghost iconButton mediaPreviewClear"
            type="button"
            onClick={handleClearUpload}
            aria-label="Remove media"
            title="Remove media"
          >
            <IconX size={16} />
          </button>
        </div>
      ) : null}

      <div className="rowActions editPostActions modalFooterInline">
        {!hasMedia ? (
          <label className="btn secondary fileInputButton" htmlFor={`editPostMediaUpload-${props.tokenId}`}>
            <IconPlus size={16} />
            Add image/video
          </label>
        ) : (
          <span />
        )}
        <button
          className="primary buttonWithSpinner"
          type="button"
          onClick={onSave}
          disabled={disableSave}
          title={props.interactionDisabledTitle}
        >
          {isSaving ? <span className="spinner" aria-hidden="true" /> : null}
          Save
        </button>
      </div>
    </div>
  );
}
