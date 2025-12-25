import type { Draft, Post } from "../types";
import { Feed } from "../components/Feed";
import { Modal } from "../components/Modal";
import { ipfsToHttp } from "../ipfs";
import { useEffect, useMemo, useState } from "react";

type Props = {
  isOwner: boolean;
  address: string;
  name: string;
  bio: string;
  avatarHue: number;
  avatarUrl?: string;

  isPosterAllowed?: boolean;
  wasPosterDisapprovedEver?: boolean;
  onAdminSetPosterAllowed: (allowed: boolean) => void;
  onAdminReset: () => void;
  onAdminSetProfile: (next: {
    name: string;
    bio: string;
    avatarUrl: string;
    avatarFile?: File | null;
    avatarFilename?: string;
    avatarDataUrl?: string;
  }) => void;

  isFollowing: boolean | undefined;
  onToggleFollow: () => void;

  posts: Post[];
  chainId: string | null;
  status: string;
  isFeedLoading: boolean;
  walletAddress: string | null;
  authorIdentity: Map<string, { name: string; hue: number; avatarUrl?: string }>;

  editingTokenId: string | null;
  editDraft: Draft;
  isEditImageLoading: boolean;
  tipDrafts: Record<string, string>;
  commentDrafts: Record<string, string>;

  onSetEditDraft: (next: Draft) => void;
  onTipDraftChange: (tokenId: string, value: string) => void;
  onCommentDraftChange: (tokenId: string, value: string) => void;

  onStartEditPost: (post: Post) => void;
  onCancelEditPost: () => void;
  onSaveEditedPost: () => void;
  onEditSelectFile: (file: File | null) => void;
  onEditClearImage: () => void;

  onAction: (tokenId: string, action: "like" | "comment" | "share") => void;
  onTip: (tokenId: string) => void;
  onBurn: (tokenId: string) => void;
  onFreezePost: (tokenId: string) => void;

  shortAddress: (address: string) => string;
  stableHueFromSeed: (seed: string) => number;
  getNativeSymbol: (chainId: string | null) => string;
  getExplorerTxUrl: (chainId: string | null, txHash: string) => string | null;
};

export function ProfilePage(props: Props) {
  const addressLabel = props.shortAddress(props.address);
  const canFollow =
    !!props.walletAddress && props.walletAddress.toLowerCase() !== props.address.toLowerCase();

  const canAdminEdit = props.isOwner && (!props.walletAddress || props.walletAddress.toLowerCase() !== props.address.toLowerCase());
  // Match Approvals modal semantics: unknown => treated as not allowed (Approve visible).
  const isAllowed = props.isPosterAllowed === true;
  const [isAdminEditing, setIsAdminEditing] = useState(false);
  const [adminName, setAdminName] = useState("");
  const [adminBio, setAdminBio] = useState("");
  const [adminAvatarUrl, setAdminAvatarUrl] = useState("");
  const [adminAvatarDataUrl, setAdminAvatarDataUrl] = useState("");
  const [adminAvatarFile, setAdminAvatarFile] = useState<File | null>(null);
  const [adminAvatarFilename, setAdminAvatarFilename] = useState<string>("");
  const [isAdminAvatarLoading, setIsAdminAvatarLoading] = useState(false);

  const initialDraft = useMemo(
    () => ({ name: props.name ?? "", bio: props.bio ?? "", avatarUrl: props.avatarUrl ?? "" }),
    [props.name, props.bio, props.avatarUrl]
  );

  useEffect(() => {
    if (isAdminEditing) return;
    setAdminName(initialDraft.name);
    setAdminBio(initialDraft.bio);
    setAdminAvatarUrl(initialDraft.avatarUrl);
    setAdminAvatarDataUrl("");
    setAdminAvatarFile(null);
    setAdminAvatarFilename("");
  }, [initialDraft, isAdminEditing]);

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

  const activePosts = props.posts.map((p) => ({ ...p, contextTag: undefined }));
  const activeLoading = props.isFeedLoading;
  const activeTitle = "Profile Feed";
  const activePill = "";
  const avatarStyle = props.avatarUrl?.trim()
    ? { backgroundImage: `url(${ipfsToHttp(props.avatarUrl)})` }
    : { background: `hsl(${props.avatarHue} 75% 55%)` };

  return (
    <main className="profileLayout">
      <section className="profileTop profileTopSingle">
        <div className="card">
          <div className="cardHeader">
            <div className="cardTitle">Profile</div>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              {canAdminEdit ? (
                <>
                  {props.wasPosterDisapprovedEver ? <span className="pill">Flagged</span> : null}
                  <button className="secondary" type="button" onClick={() => setIsAdminEditing((v) => !v)}>
                    {isAdminEditing ? "Close" : "Edit Profile"}
                  </button>
                  {isAllowed ? (
                    <button className="secondary" type="button" onClick={() => props.onAdminSetPosterAllowed(false)}>
                      Disapprove
                    </button>
                  ) : (
                    <button className="primary" type="button" onClick={() => props.onAdminSetPosterAllowed(true)}>
                      Approve
                    </button>
                  )}
                  <button className="secondary" type="button" onClick={props.onAdminReset}>
                    Reset
                  </button>
                </>
              ) : null}

              {canFollow ? (
                <button
                  className="secondary"
                  type="button"
                  onClick={props.onToggleFollow}
                  disabled={typeof props.isFollowing !== "boolean"}
                >
                  {props.isFollowing ? "Unfollow" : "Follow"}
                </button>
              ) : null}
            </div>
          </div>

          <div className="profileHeader">
            <div className="avatar" style={avatarStyle} />
            <div className="profileMain">
              <div className="profileName">{props.name || addressLabel}</div>
              <div className="profileMeta">{addressLabel}</div>
            </div>
          </div>

          <div className="profileBio">
            <div className="muted">{props.bio || "No bio yet."}</div>
          </div>
        </div>
      </section>

      {canAdminEdit ? (
        <Modal open={isAdminEditing} title="Edit profile" onClose={() => setIsAdminEditing(false)}>
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
                  setIsAdminEditing(false);
                  setAdminName(initialDraft.name);
                  setAdminBio(initialDraft.bio);
                  setAdminAvatarUrl(initialDraft.avatarUrl);
                  setAdminAvatarDataUrl("");
                  setAdminAvatarFile(null);
                  setAdminAvatarFilename("");
                }}
              >
                Cancel
              </button>
              <button
                className="primary"
                type="button"
                onClick={() =>
                  props.onAdminSetProfile({
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
      ) : null}

      <section className="content">
        <Feed
          title={activeTitle}
          pillText={activePill}
          isLoading={activeLoading}
          loadingText={props.status}
          posts={activePosts}
          isOwner={props.isOwner}
          chainId={props.chainId}
          walletAddress={props.walletAddress}
          authorIdentity={props.authorIdentity}
          editingTokenId={props.editingTokenId}
          editDraft={props.editDraft}
          isEditImageLoading={props.isEditImageLoading}
          tipDrafts={props.tipDrafts}
          commentDrafts={props.commentDrafts}
          onSetEditDraft={props.onSetEditDraft}
          onTipDraftChange={props.onTipDraftChange}
          onCommentDraftChange={props.onCommentDraftChange}
          onStartEditPost={props.onStartEditPost}
          onCancelEditPost={props.onCancelEditPost}
          onSaveEditedPost={props.onSaveEditedPost}
          onEditSelectFile={props.onEditSelectFile}
          onEditClearImage={props.onEditClearImage}
          onAction={props.onAction}
          onTip={props.onTip}
          onBurn={props.onBurn}
          onFreezePost={props.onFreezePost}
          shortAddress={props.shortAddress}
          stableHueFromSeed={props.stableHueFromSeed}
          getNativeSymbol={props.getNativeSymbol}
          getExplorerTxUrl={props.getExplorerTxUrl}
        />
      </section>
    </main>
  );
}
