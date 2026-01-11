import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import { Modal } from "@shared/components/Modal";
import { IconPlus, IconX } from "@shared/components/icons";
import { ipfsToHttp } from "@features/ipfs";

type Props = {
  open: boolean;
  avatarStyle: CSSProperties;
  profileDraftName: string;
  profileDraftBio: string;
  profileDraftAvatarUrl: string;
  profileDraftAvatarDataUrl: string;
  isProfileAvatarLoading: boolean;
  isProfileSaving: boolean;
  onProfileDraftNameChange: (value: string) => void;
  onProfileDraftBioChange: (value: string) => void;
  onSelectProfileAvatarFile: (file: File | null) => Promise<void>;
  onClearProfileAvatar: () => void;
  onCancelEditProfile: () => void;
  onSaveProfile: () => void | Promise<void>;
};

export function ProfileEditModal(props: Props) {
  const isBusy = props.isProfileAvatarLoading || props.isProfileSaving;
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [hasFileSelected, setHasFileSelected] = useState(false);
  const hasAvatarPreview = props.profileDraftAvatarDataUrl.startsWith("data:image/");
  const avatarUrlTrimmed = props.profileDraftAvatarUrl.trim();
  const hasExistingAvatar = avatarUrlTrimmed.length > 0;
  const initialNameRef = useRef<string>("");
  const initialBioRef = useRef<string>("");
  const initialAvatarUrlRef = useRef<string>("");
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (props.open && !wasOpenRef.current) {
      initialNameRef.current = props.profileDraftName;
      initialBioRef.current = props.profileDraftBio;
      initialAvatarUrlRef.current = props.profileDraftAvatarUrl;
    }
    wasOpenRef.current = props.open;
  }, [props.open, props.profileDraftName, props.profileDraftBio, props.profileDraftAvatarUrl]);

  const handleClearAvatar = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.dataset.hasFile = "false";
    }
    setHasFileSelected(false);
    props.onClearProfileAvatar();
  };
  const showUpload = !hasAvatarPreview && !hasFileSelected && !hasExistingAvatar;
  const nameTrimmed = props.profileDraftName.trim();
  const bioTrimmed = props.profileDraftBio.trim();
  const initialName = initialNameRef.current.trim();
  const initialBio = initialBioRef.current.trim();
  const initialAvatarUrl = initialAvatarUrlRef.current.trim();
  const hasChanges =
    nameTrimmed !== initialName ||
    bioTrimmed !== initialBio ||
    avatarUrlTrimmed !== initialAvatarUrl ||
    hasAvatarPreview;

  return (
    <Modal
      open={props.open}
      title="Edit profile"
      headerLeading={<div className="avatar small" style={props.avatarStyle} />}
      onClose={props.onCancelEditProfile}
    >
      <div className="composer">
        <input
          className="input"
          name="profileDisplayName"
          value={props.profileDraftName}
          onChange={(e) => props.onProfileDraftNameChange(e.target.value)}
          placeholder="Display name"
          disabled={isBusy}
        />
        <textarea
          className="textarea"
          name="profileBio"
          rows={3}
          value={props.profileDraftBio}
          onChange={(e) => props.onProfileDraftBioChange(e.target.value)}
          placeholder="Bio"
          disabled={isBusy}
        />

        <div className="row fileRow">
          <div className="fileInputWrap">
            <input
              className="file-input file-input-hidden"
              type="file"
              name="profileAvatarUpload"
              id="profileAvatarUpload"
              accept="image/heic,image/heif,image/jpeg,image/png,image/webp,image/gif"
              data-has-file="false"
              ref={fileInputRef}
              onChange={(event) => {
                const input = event.currentTarget;
                const hasFile = (input.files?.length ?? 0) > 0;
                input.dataset.hasFile = hasFile ? "true" : "false";
                setHasFileSelected(hasFile);
                const selected = input.files?.[0] ?? null;
                void props.onSelectProfileAvatarFile(selected);
              }}
              disabled={isBusy}
            />
            {showUpload ? (
              <label className="btn secondary fileInputButton" htmlFor="profileAvatarUpload">
                <IconPlus size={16} />
                Upload avatar
              </label>
            ) : null}
          </div>
        </div>

        {hasAvatarPreview ? (
          <div className="mediaPreview">
            <img className="image-preview" src={props.profileDraftAvatarDataUrl} alt="Avatar preview" />
            <button
              type="button"
              className="ghost iconButton mediaPreviewClear"
              onClick={handleClearAvatar}
              disabled={isBusy}
              aria-label="Remove avatar"
              title="Remove avatar"
            >
              <IconX size={16} />
            </button>
          </div>
        ) : hasExistingAvatar ? (
          <div className="mediaPreview">
            <img className="image-preview" src={ipfsToHttp(avatarUrlTrimmed)} alt="Current avatar" />
            <button
              type="button"
              className="ghost iconButton mediaPreviewClear"
              onClick={handleClearAvatar}
              disabled={isBusy}
              aria-label="Remove avatar"
              title="Remove avatar"
            >
              <IconX size={16} />
            </button>
          </div>
        ) : null}

        <div className="rowActions">
          <button
            className={`primary buttonWithSpinner${!hasChanges ? " notAllowed" : ""}`}
            type="button"
            onClick={props.onSaveProfile}
            disabled={isBusy || !hasChanges}
            aria-busy={props.isProfileSaving}
          >
            {props.isProfileSaving ? <span className="spinner" aria-hidden="true" /> : null}
            Save
          </button>
        </div>
      </div>
    </Modal>
  );
}
