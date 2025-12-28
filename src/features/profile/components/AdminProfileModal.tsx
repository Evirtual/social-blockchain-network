import { useEffect, useMemo, useState } from "react";
import { Modal } from "../../app";

type InitialDraft = {
  name: string;
  bio: string;
  avatarUrl: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  initialDraft: InitialDraft;
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

  const resetToInitial = useMemo(() => {
    return () => {
      setAdminName(props.initialDraft.name);
      setAdminBio(props.initialDraft.bio);
      setAdminAvatarUrl(props.initialDraft.avatarUrl);
      setAdminAvatarDataUrl("");
      setAdminAvatarFile(null);
      setAdminAvatarFilename("");
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
  }

  return (
    <Modal open={props.open} title="Edit profile" onClose={props.onClose}>
      <div className="composer">
        <input
          className="input"
          value={adminName}
          onChange={(e) => setAdminName(e.target.value)}
          placeholder="Display name"
        />
        <textarea
          className="textarea"
          rows={3}
          value={adminBio}
          onChange={(e) => setAdminBio(e.target.value)}
          placeholder="Bio"
        />

        <input
          className="input"
          value={adminAvatarUrl}
          onChange={(e) => setAdminAvatarUrl(e.target.value)}
          placeholder="Avatar image URL (or upload below)"
        />

        <div className="row fileRow">
          <input
            className="file-input"
            type="file"
            accept="image/*"
            onChange={(event) => void onSelectAdminAvatarFile(event.target.files?.[0] ?? null)}
          />
          <button type="button" className="secondary" onClick={onClearAdminAvatar}>
            Clear
          </button>
        </div>

        {adminAvatarDataUrl.startsWith("data:image/") && (
          <img className="image-preview" src={adminAvatarDataUrl} alt="Avatar preview" />
        )}

        <div className="rowActions">
          <button
            className="secondary"
            type="button"
            onClick={() => {
              props.onClose();
              resetToInitial();
            }}
          >
            Cancel
          </button>
          <button
            className="primary"
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
            disabled={isAdminAvatarLoading}
          >
            Save
          </button>
        </div>
      </div>
    </Modal>
  );
}
