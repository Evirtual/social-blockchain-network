import type { Draft } from "../types";
import { MAX_POST_BODY_LENGTH } from "../lib/postLimits";

type Props = {
  selfAvatarHue: number;
  ipfsConfigured: boolean;
  draft: Draft;
  isImageLoading: boolean;
  isPosting: boolean;
  onDraftFieldChange: (field: keyof Draft, value: string) => void;
  onImageUrlChange: (value: string) => void;
  onSelectFile: (file: File | null) => void;
  onClearImage: () => void;
  onPost: () => void | Promise<void>;
};

export function ComposerCard({
  selfAvatarHue,
  ipfsConfigured,
  draft,
  isImageLoading,
  isPosting,
  onDraftFieldChange,
  onImageUrlChange,
  onSelectFile,
  onClearImage,
  onPost
}: Props) {
  return (
    <div className="composer">
      <div className="composerHeader">
        <div className="avatar small" style={{ background: `hsl(${selfAvatarHue} 75% 55%)` }} />
        <div>
          <div className="composerTitle">Create a post</div>
          <div className="muted">Storage: {ipfsConfigured ? "IPFS (Pinata)" : "On-chain data URI (fallback)"}</div>
        </div>
      </div>
      <textarea
        className="textarea"
        rows={4}
        value={draft.body}
        maxLength={MAX_POST_BODY_LENGTH}
        onChange={(e) => onDraftFieldChange("body", e.target.value.slice(0, MAX_POST_BODY_LENGTH))}
        placeholder="What's happening?"
      />

      <div className="muted">{draft.body.length}/{MAX_POST_BODY_LENGTH}</div>

      <div className="row">
        <input
          className="input"
          value={draft.imageUrl}
          onChange={(event) => onImageUrlChange(event.target.value)}
          placeholder="Media URL (image or video) (or upload below)"
        />
      </div>

      <div className="row fileRow">
        <input
          className="file-input"
          type="file"
          accept="image/*,video/*"
          onChange={(event) => onSelectFile(event.target.files?.[0] ?? null)}
        />
        <button type="button" className="secondary" onClick={onClearImage}>
          Clear
        </button>
      </div>

      {draft.imageDataUrl.startsWith("data:image/") && (
        <img className="image-preview" src={draft.imageDataUrl} alt="Selected upload" />
      )}

      {draft.imageDataUrl.startsWith("blob:") && (
        <video className="image-preview" src={draft.imageDataUrl} controls playsInline preload="metadata" />
      )}

      <div className="rowActions">
        <button className="primary buttonWithSpinner" onClick={onPost} disabled={isImageLoading || isPosting}>
          {isPosting ? <span className="spinner" aria-hidden="true" /> : null}
          Post
        </button>
      </div>
    </div>
  );
}
