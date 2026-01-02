import type { CSSProperties } from "react";
import { AdminProfileModal } from "./AdminProfileModal";

type Props = {
  canAdminEdit: boolean;
  isAdminEditing: boolean;
  onClose: () => void;
  initialDraft: { name: string; bio: string; avatarUrl: string };
  avatarStyle: CSSProperties;
  isSaving: boolean;
  onSave: (next: {
    name: string;
    bio: string;
    avatarUrl: string;
    avatarFile?: File | null;
    avatarFilename?: string;
    avatarDataUrl?: string;
  }) => void;
};

export function ProfileAdminPanel(props: Props) {
  if (!props.canAdminEdit) return null;

  return (
    <AdminProfileModal
      open={props.isAdminEditing}
      onClose={props.onClose}
      initialDraft={props.initialDraft}
      headerLeading={<div className="avatar small" style={props.avatarStyle} />}
      isSaving={props.isSaving}
      onSave={props.onSave}
    />
  );
}
