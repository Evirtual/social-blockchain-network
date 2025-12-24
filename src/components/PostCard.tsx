import { ethers } from "ethers";
import { Link } from "react-router-dom";
import type { Draft, Post } from "../types";
import { ipfsToHttp } from "../ipfs";
import { IconBookmark, IconCoin, IconEdit, IconFlame, IconHeart, IconMessage } from "./icons";

export type PostPanel = "comment" | "tip";

type Props = {
  post: Post;
  animationDelayMs?: number;
  from: string;

  chainId: string | null;
  walletAddress: string | null;
  authorLabel: string;
  authorHue: number;
  authorAvatarUrl?: string;
  isMine: boolean;
  canModerate?: boolean;

  editingTokenId: string | null;
  editDraft: Draft;
  isEditImageLoading: boolean;
  tipDrafts: Record<string, string>;
  commentDrafts: Record<string, string>;

  openPanel: PostPanel | null;
  onTogglePanel: (panel: PostPanel) => void;

  onSetEditDraft: (next: Draft) => void;
  onTipDraftChange: (tokenId: string, value: string) => void;
  onCommentDraftChange: (tokenId: string, value: string) => void;

  onStartEditPost: (post: Post) => void;
  onCancelEditPost: () => void;
  onSaveEditedPost: () => void;
  onEditSelectFile: (file: File | null) => void;
  onEditClearImage: () => void;

  onAction: (tokenId: string, action: "like" | "comment" | "share", postChainId?: string | null) => void;
  onTip: (tokenId: string, postChainId?: string | null) => void;
  onBurn: (tokenId: string, postChainId?: string | null) => void;
  onFreezePost: (tokenId: string, postChainId?: string | null) => void;

  getNativeSymbol: (chainId: string | null) => string;
  getExplorerTxUrl: (chainId: string | null, txHash: string) => string | null;
};

export function PostCard(props: Props) {
  const tokenId = props.post.tokenId;
  const explorer = props.post.mintTxHash ? props.getExplorerTxUrl(props.chainId, props.post.mintTxHash) : null;
  const avatarStyle = props.authorAvatarUrl?.trim()
    ? { backgroundImage: `url(${ipfsToHttp(props.authorAvatarUrl)})` }
    : { background: `hsl(${props.authorHue} 75% 55%)` };

  const description = (
    <>
      <div className="postText">
        <p>{props.post.body}</p>
      </div>
      {props.post.mintTxHash ? (
        <a
          href={explorer ?? "#"}
          target={explorer ? "_blank" : undefined}
          rel={explorer ? "noreferrer" : undefined}
          title={explorer ? "View mint transaction" : "Copy mint transaction hash"}
          onClick={(e) => {
            if (explorer) return;
            e.preventDefault();
              if (props.post.mintTxHash) {
                void navigator.clipboard?.writeText(props.post.mintTxHash);
              }
          }}
        >
          View mint transaction
        </a>
      ) : null}
    </>
  );

  return (
    <article key={tokenId} className="post" style={{ animationDelay: `${props.animationDelayMs ?? 0}ms` }}>
      <div className="postHead">
        <div className="avatar small" style={avatarStyle} />
        <div className="postHeadMain">
          <div className="postHeadTop">
            <div className="postAuthor">
              {props.post.author ? <Link to={`/profile/${props.post.author}`}>{props.authorLabel}</Link> : props.authorLabel}
              {props.isMine ? <span className="badge">You</span> : null}
            </div>
            <div className="postTokenArea">
              <Link className="postTokenLink" to={`/post/${tokenId}`} state={{ from: props.from }}>
                Token #{tokenId}
              </Link>
              {props.post.contextTag === "saved" ? (
                <span className="badge savedBadge">
                  <IconBookmark size={14} filled />
                  <span>Saved</span>
                </span>
              ) : null}
              {(props.isMine || props.canModerate) && props.editingTokenId !== tokenId ? (
                <span className="postTokenActions">
                  <button
                    className="ghost iconButton"
                    type="button"
                    onClick={() => props.onStartEditPost(props.post)}
                    aria-label="Edit post"
                    title="Edit"
                  >
                    <IconEdit size={16} />
                  </button>
                  <button
                    className="danger iconButton"
                    type="button"
                    onClick={() => props.onBurn(tokenId)}
                    aria-label="Burn post"
                    title="Burn"
                  >
                    <IconFlame size={16} />
                  </button>
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {props.editingTokenId === tokenId ? (
        <div className="editBox">
          <textarea
            className="textarea"
            rows={4}
            value={props.editDraft.body}
            onChange={(e) => props.onSetEditDraft({ ...props.editDraft, body: e.target.value })}
            placeholder="Post text"
          />
          <input
            className="input"
            value={props.editDraft.imageUrl}
            onChange={(e) => {
              const v = e.target.value;
              props.onSetEditDraft({ ...props.editDraft, imageUrl: v, imageDataUrl: "" });
            }}
            placeholder="Image URL"
          />

          <div className="row fileRow">
            <input
              className="file-input"
              type="file"
              accept="image/*,video/*"
              onChange={(e) => props.onEditSelectFile(e.target.files?.[0] ?? null)}
            />
            <button className="secondary" type="button" onClick={props.onEditClearImage}>
              Clear
            </button>
          </div>

          {props.editDraft.imageDataUrl.startsWith("data:image/") && (
            <img className="image-preview" src={props.editDraft.imageDataUrl} alt="Edit preview" />
          )}

          {props.editDraft.imageDataUrl.startsWith("blob:") && (
            <video className="image-preview" src={props.editDraft.imageDataUrl} controls playsInline preload="metadata" />
          )}

          <div className="rowActions">
            {props.isMine ? (
              <button className="danger" type="button" onClick={() => props.onFreezePost(tokenId)}>
                Freeze
              </button>
            ) : null}
            <button className="secondary" type="button" onClick={props.onCancelEditPost}>
              Cancel
            </button>
            <button className="primary" type="button" onClick={props.onSaveEditedPost} disabled={props.isEditImageLoading}>
              Save
            </button>
          </div>
        </div>
      ) : (
        <>
          {!!props.post.animationUrl ? (
            <Link className="postImageLink" to={`/post/${tokenId}`} state={{ from: props.from }} aria-label="Open post">
              <video
                className="postImage"
                src={ipfsToHttp(props.post.animationUrl)}
                poster={props.post.image ? ipfsToHttp(props.post.image) : undefined}
                controls
                playsInline
                preload="metadata"
              />
            </Link>
          ) : props.post.image ? (
            <Link className="postImageLink" to={`/post/${tokenId}`} state={{ from: props.from }} aria-label="Open post">
              <img className="postImage" src={ipfsToHttp(props.post.image)} alt="Post image" loading="lazy" />
            </Link>
          ) : null}

          {props.post.image || props.post.animationUrl ? null : <div className="post-body">{description}</div>}
        </>
      )}

      <div className="postFooter">
        <div className="postStats">
          <button
            className={`statPill statButton ${props.post.likedByMe ? "isActive isLike" : ""}`}
            type="button"
            onClick={() => props.onAction(tokenId, "like")}
            aria-label="Like"
          >
            <IconHeart size={18} filled={!!props.post.likedByMe} />
            <span className="statValue">{props.post.likes}</span>
          </button>

          <button
            className={`statPill statButton ${props.post.repostedByMe ? "isActive isSaved" : ""}`}
            type="button"
            onClick={() => props.onAction(tokenId, "share")}
            aria-label="Save"
          >
            <IconBookmark size={18} filled={!!props.post.repostedByMe} />
            <span className="statValue">{props.post.shares}</span>
          </button>

          <button
            className="statPill statButton"
            type="button"
            onClick={() => props.onTogglePanel("comment")}
            aria-label="Comment"
            aria-expanded={props.openPanel === "comment"}
            aria-controls={`comment-${tokenId}`}
          >
            <IconMessage size={18} />
            <span className="statValue">{props.post.comments}</span>
          </button>

          <button
            className="statPill statButton statTip"
            type="button"
            onClick={() => props.onTogglePanel("tip")}
            aria-label="Tip"
            aria-expanded={props.openPanel === "tip"}
            aria-controls={`tip-${tokenId}`}
          >
            <IconCoin size={18} />
            <span className="statValue">
              {Number(ethers.formatEther(props.post.tipsWei)).toFixed(6)} {props.getNativeSymbol(props.chainId)}
            </span>
          </button>
        </div>

        {props.openPanel === "tip" ? (
          <div className="postForm" id={`tip-${tokenId}`}>
            <div className="postFormRow">
              <input
                className="postField"
                type="text"
                value={props.tipDrafts[tokenId] || ""}
                onChange={(event) => props.onTipDraftChange(tokenId, event.target.value)}
                placeholder={`Tip amount in ${props.getNativeSymbol(props.chainId)} (e.g. 0.001)`}
              />
              <button className="primary" type="button" onClick={() => props.onTip(tokenId)}>
                Tip
              </button>
            </div>
          </div>
        ) : null}

        {props.openPanel === "comment" ? (
          <div className="postForm" id={`comment-${tokenId}`}>
            <div className="postFormRow">
              <input
                className="postField"
                type="text"
                value={props.commentDrafts[tokenId] || ""}
                onChange={(event) => props.onCommentDraftChange(tokenId, event.target.value)}
                placeholder="Write a comment to sign"
              />
              <button className="secondary" type="button" onClick={() => props.onAction(tokenId, "comment")}>
                Sign
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {props.editingTokenId === tokenId || !props.post.image ? null : <div className="postCaption">{description}</div>}
    </article>
  );
}
