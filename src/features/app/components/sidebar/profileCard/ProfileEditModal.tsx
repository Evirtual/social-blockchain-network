import type { CSSProperties } from "react";
import { Modal } from "@shared/components/Modal";

type Props = {
  open: boolean;
  avatarStyle: CSSProperties;
  profileDraftName: string;
  profileDraftBio: string;
  profileDraftAvatarUrl: string;
  profileDraftAvatarDataUrl: string;
  isProfileAvatarLoading: boolean;
  onProfileDraftNameChange: (value: string) => void;
  onProfileDraftBioChange: (value: string) => void;
  onProfileDraftAvatarUrlChange: (value: string) => void;
  onSelectProfileAvatarFile: (file: File | null) => Promise<void>;
  onClearProfileAvatar: () => void;
  onCancelEditProfile: () => void;
  onSaveProfile: () => void | Promise<void>;
};

export function ProfileEditModal(props: Props) {
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
          value={props.profileDraftName}
          onChange={(e) => props.onProfileDraftNameChange(e.target.value)}
          placeholder="Display name"
        />
        <textarea
          className="textarea"
          rows={3}
          value={props.profileDraftBio}
          onChange={(e) => props.onProfileDraftBioChange(e.target.value)}
          placeholder="Bio"
        />

        <input
          className="input"
          value={props.profileDraftAvatarUrl}
          onChange={(e) => props.onProfileDraftAvatarUrlChange(e.target.value)}
          placeholder="Avatar image URL (or upload below)"
        />

        <div className="row fileRow">
          <input
            className="file-input"
            type="file"
            accept="image/*"
            onChange={(event) => props.onSelectProfileAvatarFile(event.target.files?.[0] ?? null)}
          />
          <button type="button" className="secondary" onClick={props.onClearProfileAvatar}>
            Clear
          </button>
        </div>

        {props.profileDraftAvatarDataUrl.startsWith("data:image/") && (
          <img className="image-preview" src={props.profileDraftAvatarDataUrl} alt="Avatar preview" />
        )}

        <div className="rowActions">
          <button className="secondary" type="button" onClick={props.onCancelEditProfile}>
            Cancel
          </button>
          <button className="primary" type="button" onClick={props.onSaveProfile} disabled={props.isProfileAvatarLoading}>
            Save
          </button>
        </div>
      </div>
    </Modal>
  );
}
