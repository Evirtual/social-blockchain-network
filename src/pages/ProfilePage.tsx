import type { Draft, Post } from "../types";
import { Feed } from "../components/Feed";
import { ipfsToHttp } from "../ipfs";

type Props = {
  address: string;
  name: string;
  bio: string;
  avatarHue: number;
  avatarUrl?: string;

  posts: Post[];
  chainId: string | null;
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

  onAction: (tokenId: string, action: "like" | "comment") => void;
  onTip: (tokenId: string) => void;
  onBurn: (tokenId: string) => void;

  shortAddress: (address: string) => string;
  stableHueFromSeed: (seed: string) => number;
  getNativeSymbol: (chainId: string | null) => string;
  getExplorerTxUrl: (chainId: string | null, txHash: string) => string | null;
};

export function ProfilePage(props: Props) {
  const addressLabel = props.shortAddress(props.address);
  const avatarStyle = props.avatarUrl?.trim()
    ? { backgroundImage: `url(${ipfsToHttp(props.avatarUrl)})` }
    : { background: `hsl(${props.avatarHue} 75% 55%)` };

  return (
    <main className="profileLayout">
      <section className="profileTop profileTopSingle">
        <div className="card">
          <div className="cardHeader">
            <div className="cardTitle">Profile</div>
            <span className="pill">{props.posts.length} posts</span>
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

      <section className="content">
        <Feed
          title="Profile Feed"
          pillText={`${props.posts.length} posts`}
          posts={props.posts}
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
          shortAddress={props.shortAddress}
          stableHueFromSeed={props.stableHueFromSeed}
          getNativeSymbol={props.getNativeSymbol}
          getExplorerTxUrl={props.getExplorerTxUrl}
        />
      </section>
    </main>
  );
}
