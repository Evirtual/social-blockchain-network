import { useEffect, useMemo, useRef, useState } from "react";
import { Modal } from "@shared/components/Modal";
import { IconPlus, IconX } from "@shared/components/icons";

type InitialDraft = {
  name: string;
  bio: string;
  avatarUrl: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  headerLeading?: React.ReactNode;
  initialDraft: InitialDraft;
  isSaving?: boolean;
  onSave: (next: {
    name: string;
    bio: string;
    avatarUrl: string;
    avatarFile?: File | null;
    avatarFilename?: string;
    avatarDataUrl?: string;
  }) => void;
};

export function AdminProfileModal(props: Props) {
  const [adminName, setAdminName] = useState("");
  const [adminBio, setAdminBio] = useState("");
  const [adminAvatarUrl, setAdminAvatarUrl] = useState("");
  const [adminAvatarDataUrl, setAdminAvatarDataUrl] = useState("");
  const [adminAvatarFile, setAdminAvatarFile] = useState<File | null>(null);
  const [adminAvatarFilename, setAdminAvatarFilename] = useState<string>("");
  const [isAdminAvatarLoading, setIsAdminAvatarLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [hasFileSelected, setHasFileSelected] = useState(false);
  const hasAvatarPreview = adminAvatarDataUrl.startsWith("data:image/");
  const nameTrimmed = adminName.trim();
  const bioTrimmed = adminBio.trim();
  const avatarUrlTrimmed = adminAvatarUrl.trim();
  const initialName = props.initialDraft.name.trim();
  const initialBio = props.initialDraft.bio.trim();
  const initialAvatarUrl = props.initialDraft.avatarUrl.trim();
  const hasChanges =
    nameTrimmed !== initialName ||
    bioTrimmed !== initialBio ||
    avatarUrlTrimmed !== initialAvatarUrl ||
    Boolean(adminAvatarFile) ||
    hasAvatarPreview;

  const resetToInitial = useMemo(() => {
    return () => {
      setAdminName(props.initialDraft.name);
      setAdminBio(props.initialDraft.bio);
      setAdminAvatarUrl(props.initialDraft.avatarUrl);
      setAdminAvatarDataUrl("");
      setAdminAvatarFile(null);
      setAdminAvatarFilename("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
        fileInputRef.current.dataset.hasFile = "false";
      }
      setHasFileSelected(false);
    };
  }, [props.initialDraft]);

  useEffect(() => {
    if (props.open) return;
    resetToInitial();
  }, [props.open, resetToInitial]);

  useEffect(() => {
    if (!props.open) return;
    resetToInitial();
  }, [props.initialDraft, props.open, resetToInitial]);

  async function onSelectAdminAvatarFile(file: File | null) {
    if (!file) {
      setAdminAvatarFile(null);
      setAdminAvatarFilename("");
      setAdminAvatarDataUrl("");
      return;
    }

    setIsAdminAvatarLoading(true);
    try {
      setAdminAvatarFile(file);
      setAdminAvatarFilename(file.name || "avatar.png");

      const reader = new FileReader();
      try {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(String(reader.result || ""));
          reader.onerror = () => reject(new Error("Failed to read file."));
          reader.readAsDataURL(file);
        });

        setAdminAvatarUrl("");
        setAdminAvatarDataUrl(dataUrl);
      } catch {
        setAdminAvatarFile(null);
        setAdminAvatarFilename("");
        setAdminAvatarDataUrl("");
      }
    } finally {
      setIsAdminAvatarLoading(false);
    }
  }

  function onClearAdminAvatar() {
    setAdminAvatarUrl("");
    setAdminAvatarDataUrl("");
    setAdminAvatarFile(null);
    setAdminAvatarFilename("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.dataset.hasFile = "false";
    }
    setHasFileSelected(false);
  }
  const showUpload = !hasAvatarPreview && !hasFileSelected;

  return (
    <Modal
      open={props.open}
      title="Edit profile"
      headerLeading={props.headerLeading}
      onClose={props.onClose}
    >
      <div className="composer">
        <input
          className="input"
          name="adminProfileName"
          value={adminName}
          onChange={(e) => setAdminName(e.target.value)}
          placeholder="Display name"
        />
        <textarea
          className="textarea"
          name="adminProfileBio"
          rows={3}
          value={adminBio}
          onChange={(e) => setAdminBio(e.target.value)}
          placeholder="Bio"
        />

        <div className="row fileRow">
          <div className="fileInputWrap">
            <input
              className="file-input file-input-hidden"
              type="file"
              name="adminProfileAvatarUpload"
              id="adminProfileAvatarUpload"
              accept="image/heic,image/heif,image/jpeg,image/png,image/webp,image/gif"
              data-has-file="false"
              ref={fileInputRef}
              onChange={(event) => {
                const input = event.currentTarget;
                const hasFile = (input.files?.length ?? 0) > 0;
                input.dataset.hasFile = hasFile ? "true" : "false";
                setHasFileSelected(hasFile);
                const selected = input.files?.[0] ?? null;
                void onSelectAdminAvatarFile(selected);
              }}
            />
            {showUpload ? (
              <label className="btn secondary fileInputButton" htmlFor="adminProfileAvatarUpload">
                <IconPlus size={16} />
                Upload avatar
              </label>
            ) : null}
          </div>
        </div>

        {hasAvatarPreview && (
          <div className="mediaPreview">
            <img className="image-preview" src={adminAvatarDataUrl} alt="Avatar preview" />
            <button
              type="button"
              className="ghost iconButton mediaPreviewClear"
              onClick={onClearAdminAvatar}
              aria-label="Remove avatar"
              title="Remove avatar"
            >
              <IconX size={16} />
            </button>
          </div>
        )}

        <div className="rowActions">
          <button
            className={`primary buttonWithSpinner${!hasChanges ? " notAllowed" : ""}`}
            type="button"
            onClick={() =>
              props.onSave({
                name: adminName,
                bio: adminBio,
                avatarUrl: adminAvatarUrl,
                avatarFile: adminAvatarFile,
                avatarFilename: adminAvatarFilename,
                avatarDataUrl: adminAvatarDataUrl
              })
            }
            disabled={isAdminAvatarLoading || props.isSaving || !hasChanges}
            aria-busy={props.isSaving}
          >
            {props.isSaving ? <span className="spinner" aria-hidden="true" /> : null}
            Save
          </button>
        </div>
      </div>
    </Modal>
  );
}
