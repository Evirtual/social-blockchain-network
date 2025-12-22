import type { Draft } from "../types";

type Props = {
  selfAvatarHue: number;
  ipfsConfigured: boolean;
  draft: Draft;
  isImageLoading: boolean;
  onDraftFieldChange: (field: keyof Draft, value: string) => void;
  onImageUrlChange: (value: string) => void;
  onSelectFile: (file: File | null) => void;
  onClearImage: () => void;
  onPost: () => void;
};

export function ComposerCard({
  selfAvatarHue,
  ipfsConfigured,
  draft,
  isImageLoading,
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
        onChange={(e) => onDraftFieldChange("body", e.target.value)}
        placeholder="What's happening?"
      />

      <div className="row">
        <input
          className="input"
          value={draft.imageUrl}
          onChange={(event) => onImageUrlChange(event.target.value)}
          placeholder="Image URL (or upload below)"
        />
      </div>

      <div className="row fileRow">
        <input
          className="file-input"
          type="file"
          accept="image/*"
          onChange={(event) => onSelectFile(event.target.files?.[0] ?? null)}
        />
        <button type="button" className="secondary" onClick={onClearImage}>
          Clear
        </button>
      </div>

      {draft.imageDataUrl.startsWith("data:image/") && (
        <img className="image-preview" src={draft.imageDataUrl} alt="Selected upload" />
      )}

      <div className="rowActions">
        <button className="primary" onClick={onPost} disabled={isImageLoading}>
          Post
        </button>
      </div>
    </div>
  );
}
