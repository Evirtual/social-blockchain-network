import type { Draft } from "@types";
import { useRef, useState } from "react";
import { MAX_POST_BODY_LENGTH } from "@shared/lib/postLimits";
import { IconPlus, IconX } from "@shared/components/icons";

type Props = {
  draft: Draft;
  isImageLoading: boolean;
  isPosting: boolean;
  onDraftFieldChange: (field: keyof Draft, value: string) => void;
  onSelectFile: (file: File | null) => void;
  onClearImage: () => void;
  onPost: () => void | Promise<void>;
};

export function ComposerCard({
  draft,
  isImageLoading,
  isPosting,
  onDraftFieldChange,
  onSelectFile,
  onClearImage,
  onPost
}: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [hasFileSelected, setHasFileSelected] = useState(false);

  const handleClearUpload = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.dataset.hasFile = "false";
    }
    setHasFileSelected(false);
    onClearImage();
  };
  const hasMedia = Boolean(draft.imageDataUrl) || hasFileSelected;

  return (
    <div className="composer">
      <input
        className="file-input file-input-hidden"
        type="file"
        name="postMediaUpload"
        id="postMediaUpload"
        accept="image/heic,image/heif,image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/ogg"
        data-has-file="false"
        ref={fileInputRef}
        onChange={(event) => {
          const input = event.currentTarget;
          const hasFile = (input.files?.length ?? 0) > 0;
          input.dataset.hasFile = hasFile ? "true" : "false";
          setHasFileSelected(hasFile);
          onSelectFile(input.files?.[0] ?? null);
        }}
      />

      <textarea
        className="textarea"
        name="postBody"
        rows={4}
        value={draft.body}
        maxLength={MAX_POST_BODY_LENGTH}
        onChange={(e) => onDraftFieldChange("body", e.target.value.slice(0, MAX_POST_BODY_LENGTH))}
        placeholder="What's happening?"
      />

      <div className="muted">{draft.body.length}/{MAX_POST_BODY_LENGTH}</div>

      {draft.imageDataUrl.startsWith("data:image/") ? (
        <div className="mediaPreview">
          <img className="image-preview" src={draft.imageDataUrl} alt="Selected upload" />
          <button
            type="button"
            className="ghost iconButton mediaPreviewClear"
            onClick={handleClearUpload}
            aria-label="Remove media"
            title="Remove media"
          >
            <IconX size={16} />
          </button>
        </div>
      ) : null}

      {draft.imageDataUrl.startsWith("blob:") ? (
        <div className="mediaPreview">
          <video className="image-preview" src={draft.imageDataUrl} controls playsInline preload="metadata" />
          <button
            type="button"
            className="ghost iconButton mediaPreviewClear"
            onClick={handleClearUpload}
            aria-label="Remove media"
            title="Remove media"
          >
            <IconX size={16} />
          </button>
        </div>
      ) : null}

      <div className="rowActions modalFooterInline">
        {!hasMedia ? (
          <label className="btn secondary fileInputButton" htmlFor="postMediaUpload">
            <IconPlus size={16} />
            Add image/video
          </label>
        ) : (
          <span />
        )}
        <button
          className="primary buttonWithSpinner"
          onClick={onPost}
          disabled={isImageLoading || isPosting || (!draft.body.trim() && !draft.imageDataUrl)}
        >
          {isPosting ? <span className="spinner" aria-hidden="true" /> : null}
          Post
        </button>
      </div>
    </div>
  );
}
