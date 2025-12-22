import { ethers } from "ethers";
import { Link } from "react-router-dom";
import type { Draft, Post } from "../types";
import { ipfsToHttp } from "../ipfs";
import { getNetworkBadgeLabel } from "../lib/chain";

export type PostPanel = "comment" | "tip";

type Props = {
  post: Post;
  panelKey: string;
  animationDelayMs?: number;
  from: string;

  chainId: string | null;
  walletAddress: string | null;
  authorLabel: string;
  authorHue: number;
  authorAvatarUrl?: string;
  isMine: boolean;

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

  onAction: (tokenId: string, action: "like" | "comment", postChainId?: string | null) => void;
  onTip: (tokenId: string, postChainId?: string | null) => void;
  onBurn: (tokenId: string, postChainId?: string | null) => void;

  getNativeSymbol: (chainId: string | null) => string;
  getExplorerTxUrl: (chainId: string | null, txHash: string) => string | null;
};

export function PostCard(props: Props) {
  const tokenId = props.post.tokenId;
  const postChainId = props.post.chainId ?? props.chainId;
  const explorer = props.post.mintTxHash ? props.getExplorerTxUrl(postChainId, props.post.mintTxHash) : null;
  const avatarStyle = props.authorAvatarUrl?.trim()
    ? { backgroundImage: `url(${ipfsToHttp(props.authorAvatarUrl)})` }
    : { background: `hsl(${props.authorHue} 75% 55%)` };

  const networkBadge = getNetworkBadgeLabel(postChainId);
  const postLink = postChainId ? `/post/${tokenId}?chainId=${encodeURIComponent(postChainId)}` : `/post/${tokenId}`;

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
            void navigator.clipboard?.writeText(props.post.mintTxHash || "");
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
              <Link className="postTokenLink" to={postLink} state={{ from: props.from }}>
                Token #{tokenId}
              </Link>
              {networkBadge ? <span className="badge networkBadge">{networkBadge}</span> : null}
              {props.isMine && props.editingTokenId !== tokenId ? (
                <span className="postTokenActions">
                  <button
                    className="ghost iconButton"
                    type="button"
                    onClick={() => props.onStartEditPost(props.post)}
                    aria-label="Edit post"
                    title="Edit"
                  >
                    ✎
                  </button>
                  <button
                    className="danger iconButton"
                    type="button"
                    onClick={() => props.onBurn(tokenId, postChainId)}
                    aria-label="Burn post"
                    title="Burn"
                  >
                    🔥
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
              accept="image/*"
              onChange={(e) => props.onEditSelectFile(e.target.files?.[0] ?? null)}
            />
            <button className="secondary" type="button" onClick={props.onEditClearImage}>
              Clear
            </button>
          </div>

          {props.editDraft.imageDataUrl.startsWith("data:image/") && (
            <img className="image-preview" src={props.editDraft.imageDataUrl} alt="Edit preview" />
          )}

          <div className="rowActions">
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
          {!!props.post.image && (
            <Link className="postImageLink" to={postLink} state={{ from: props.from }} aria-label="Open post">
              <img className="postImage" src={ipfsToHttp(props.post.image)} alt="Post image" loading="lazy" />
            </Link>
          )}
          {props.post.image ? null : <div className="post-body">{description}</div>}
        </>
      )}

      <div className="postFooter">
        <div className="postStats">
          <button className="statPill statButton" type="button" onClick={() => props.onAction(tokenId, "like", postChainId)} aria-label="Like">
            ❤ {props.post.likes}
          </button>

          <button
            className="statPill statButton"
            type="button"
            onClick={() => props.onTogglePanel("comment")}
            aria-label="Comment"
            aria-expanded={props.openPanel === "comment"}
            aria-controls={`comment-${props.panelKey}`}
          >
            💬 {props.post.comments}
          </button>

          <button
            className="statPill statButton"
            type="button"
            onClick={() => props.onTogglePanel("tip")}
            aria-label="Tip"
            aria-expanded={props.openPanel === "tip"}
            aria-controls={`tip-${props.panelKey}`}
          >
            ⟠ {Number(ethers.formatEther(props.post.tipsWei)).toFixed(6)} {props.getNativeSymbol(postChainId)}
          </button>
        </div>

        {props.openPanel === "tip" ? (
          <div className="postForm" id={`tip-${props.panelKey}`}>
            <div className="postFormRow">
              <input
                className="postField"
                type="text"
                value={props.tipDrafts[tokenId] || ""}
                onChange={(event) => props.onTipDraftChange(tokenId, event.target.value)}
                placeholder={`Tip amount in ${props.getNativeSymbol(postChainId)} (e.g. 0.001)`}
              />
              <button className="primary" type="button" onClick={() => props.onTip(tokenId, postChainId)}>
                Tip
              </button>
            </div>
          </div>
        ) : null}

        {props.openPanel === "comment" ? (
          <div className="postForm" id={`comment-${props.panelKey}`}>
            <div className="postFormRow">
              <input
                className="postField"
                type="text"
                value={props.commentDrafts[tokenId] || ""}
                onChange={(event) => props.onCommentDraftChange(tokenId, event.target.value)}
                placeholder="Write a comment to sign"
              />
              <button className="secondary" type="button" onClick={() => props.onAction(tokenId, "comment", postChainId)}>
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
