import type { CSSProperties } from "react";
import { Modal } from "@shared/components/Modal";
import { IconRepeat } from "@shared/components/icons";

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
  onProfileDraftAvatarUrlChange: (value: string) => void;
  onSelectProfileAvatarFile: (file: File | null) => Promise<void>;
  onClearProfileAvatar: () => void;
  onCancelEditProfile: () => void;
  onSaveProfile: () => void | Promise<void>;
};

export function ProfileEditModal(props: Props) {
  const isBusy = props.isProfileAvatarLoading || props.isProfileSaving;

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

        <input
          className="input"
          name="profileAvatarUrl"
          value={props.profileDraftAvatarUrl}
          onChange={(e) => props.onProfileDraftAvatarUrlChange(e.target.value)}
          placeholder="Avatar image URL (or upload below)"
          disabled={isBusy}
        />

        <div className="row fileRow">
          <div className="fileInputWrap">
            <input
              className="file-input"
              type="file"
              name="profileAvatarUpload"
              accept="image/*"
              onChange={(event) => props.onSelectProfileAvatarFile(event.target.files?.[0] ?? null)}
              disabled={isBusy}
            />
            <button
              type="button"
              className="ghost iconButton fileInputAction"
              onClick={props.onClearProfileAvatar}
              disabled={isBusy}
              aria-label="Clear avatar upload"
              title="Clear avatar upload"
            >
              <IconRepeat size={16} />
            </button>
          </div>
        </div>

        {props.profileDraftAvatarDataUrl.startsWith("data:image/") && (
          <img className="image-preview" src={props.profileDraftAvatarDataUrl} alt="Avatar preview" />
        )}

        <div className="rowActions">
          <button
            className="primary buttonWithSpinner"
            type="button"
            onClick={props.onSaveProfile}
            disabled={isBusy}
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
