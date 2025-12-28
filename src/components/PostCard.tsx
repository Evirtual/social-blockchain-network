import { memo, useCallback, useEffect, useState } from "react";
import { formatEther } from "ethers";
import { Link } from "react-router-dom";
import type { Draft, Post } from "../types";
import { ipfsToHttp, ipfsToHttpWithGateway } from "../ipfs";
import { getNetworkBadgeLabel } from "../lib/chain";
import { MAX_POST_BODY_LENGTH } from "../lib/postLimits";
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

  isEditing: boolean;
  editDraft: Draft | null;
  isEditImageLoading: boolean;

  openPanel: PostPanel | null;
  panelKey: string;
  togglePanel: (id: string, panel: PostPanel) => void;

  onSetEditDraft: (next: Draft) => void;

  onStartEditPost: (post: Post) => void;
  onCancelEditPost: () => void;
  onSaveEditedPost: () => void;
  onEditSelectFile: (file: File | null) => void;
  onEditClearImage: () => void;

  onAction: (
    tokenId: string,
    action: "like" | "comment" | "save",
    postChainId?: string | null,
    comment?: string
  ) => Promise<boolean>;
  onTip: (tokenId: string, amountRaw: string, postChainId?: string | null) => Promise<boolean>;
  onBurn: (tokenId: string, postChainId?: string | null) => void;
  onFreezePost: (tokenId: string, postChainId?: string | null) => void;

  getNativeSymbol: (chainId: string | null) => string;
  getExplorerTxUrl: (chainId: string | null, txHash: string) => string | null;
};

export const PostCard = memo(function PostCard(props: Props) {
  const tokenId = props.post.tokenId;
  const explorer = props.post.mintTxHash
    ? props.getExplorerTxUrl(props.post.chainId ?? props.chainId, props.post.mintTxHash)
    : null;
  const hasMedia = !!props.post.image || !!props.post.animationUrl;
  const postUrl = props.post.chainId ? `/post/${props.post.chainId}/${tokenId}` : `/post/${tokenId}`;
  const avatarStyle = props.authorAvatarUrl?.trim()
    ? { backgroundImage: `url(${ipfsToHttp(props.authorAvatarUrl)})` }
    : { background: `hsl(${props.authorHue} 75% 55%)` };

  const postNetworkLabel = props.post.chainId ? getNetworkBadgeLabel(props.post.chainId) : "";
  const isCurrentNetworkPost =
    !!props.chainId && !!props.post.chainId && props.post.chainId === props.chainId;
  const requiresNetworkSwitch =
    !!props.walletAddress && !!props.chainId && !!props.post.chainId && props.post.chainId !== props.chainId;
  const interactionDisabledTitle = requiresNetworkSwitch
    ? `Switch to ${postNetworkLabel} to interact with this post.`
    : undefined;

  const description = (
    <>
      <div className="postText">
        <p>{props.post.body}</p>
      </div>
    </>
  );

  const fallbackGateway = "https://ipfs.io/ipfs/";

  const animationPrimaryUrl = props.post.animationUrl ? ipfsToHttp(props.post.animationUrl) : "";
  const imagePrimaryUrl = props.post.image ? ipfsToHttp(props.post.image) : "";

  const [animationSrc, setAnimationSrc] = useState<string>(animationPrimaryUrl);
  const [imageSrc, setImageSrc] = useState<string>(imagePrimaryUrl);

  // Keep state in sync if the post changes.
  // Use effects so user-driven state (like IPFS gateway fallback) isn't overwritten.
  useEffect(() => {
    setAnimationSrc((prev) => (prev.startsWith("blob:") ? prev : animationPrimaryUrl));
  }, [animationPrimaryUrl]);

  useEffect(() => {
    setImageSrc((prev) => (prev.startsWith("blob:") ? prev : imagePrimaryUrl));
  }, [imagePrimaryUrl]);

  const onTogglePanel = useCallback(
    (panel: PostPanel) => {
      props.togglePanel(props.panelKey, panel);
    },
    [props.togglePanel, props.panelKey]
  );

  const [tipDraft, setTipDraft] = useState<string>("");
  const [commentDraft, setCommentDraft] = useState<string>("");

  useEffect(() => {
    setTipDraft("");
    setCommentDraft("");
  }, [tokenId]);

  const onSubmitTip = useCallback(async () => {
    const ok = await props.onTip(tokenId, tipDraft, props.post.chainId);
    if (ok) setTipDraft("");
  }, [props, tokenId, tipDraft]);

  const onSubmitComment = useCallback(async () => {
    const ok = await props.onAction(tokenId, "comment", props.post.chainId, commentDraft);
    if (ok) setCommentDraft("");
  }, [props, tokenId, commentDraft]);

  return (
    <article className="post" style={{ animationDelay: `${props.animationDelayMs ?? 0}ms` }}>
      <div className="postHead">
        <div className="avatar small" style={avatarStyle} />
        <div className="postHeadMain">
          <div className="postHeadTop">
            <div className="postAuthor">
              {props.post.author ? <Link to={`/profile/${props.post.author}`}>{props.authorLabel}</Link> : props.authorLabel}
              {props.isMine ? <span className="badge">You</span> : null}
            </div>
            <div className="postTokenArea">
              <Link
                className="postTokenLink"
                to={postUrl}
                state={{ from: props.from, chainId: props.post.chainId ?? null }}
              >
                Token #{tokenId}
              </Link>
              {postNetworkLabel ? (
                props.post.mintTxHash ? (
                  <a
                    className={`badge networkBadge ${isCurrentNetworkPost ? "isCurrentNetwork" : ""}`}
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
                    {postNetworkLabel}
                  </a>
                ) : (
                  <span className={`badge networkBadge ${isCurrentNetworkPost ? "isCurrentNetwork" : ""}`}>
                    {postNetworkLabel}
                  </span>
                )
              ) : null}
              {(props.isMine || props.canModerate) && !props.isEditing ? (
                <span className="postTokenActions">
                  <button
                    className={`ghost iconButton${requiresNetworkSwitch ? " notAllowed" : ""}`}
                    type="button"
                    onClick={() => props.onStartEditPost(props.post)}
                    aria-label="Edit post"
                    title="Edit"
                    disabled={requiresNetworkSwitch}
                  >
                    <IconEdit size={16} />
                  </button>
                  <button
                    className={`danger iconButton${requiresNetworkSwitch ? " notAllowed" : ""}`}
                    type="button"
                    onClick={() => props.onBurn(tokenId, props.post.chainId)}
                    aria-label="Burn post"
                    title="Burn"
                    disabled={requiresNetworkSwitch}
                  >
                    <IconFlame size={16} />
                  </button>
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {props.isEditing ? (
        <div className="editBox">
          <textarea
            className="textarea"
            rows={4}
            value={props.editDraft?.body ?? ""}
            maxLength={MAX_POST_BODY_LENGTH}
            onChange={(e) => {
              const nextBody = e.target.value.slice(0, MAX_POST_BODY_LENGTH);
              const base = props.editDraft ?? { title: "", body: "", imageUrl: "", imageDataUrl: "" };
              props.onSetEditDraft({ ...base, body: nextBody });
            }}
            placeholder="Post text"
          />
          <div className="muted">{(props.editDraft?.body ?? "").length}/{MAX_POST_BODY_LENGTH}</div>
          <input
            className="input"
            value={props.editDraft?.imageUrl ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              const base = props.editDraft ?? { title: "", body: "", imageUrl: "", imageDataUrl: "" };
              props.onSetEditDraft({ ...base, imageUrl: v, imageDataUrl: "" });
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

          {props.editDraft?.imageDataUrl?.startsWith("data:image/") && (
            <img className="image-preview" src={props.editDraft.imageDataUrl} alt="Edit preview" />
          )}

          {props.editDraft?.imageDataUrl?.startsWith("blob:") && (
            <video className="image-preview" src={props.editDraft.imageDataUrl} controls playsInline preload="metadata" />
          )}

          <div className="rowActions">
            {props.isMine ? (
              <button
                className="danger"
                type="button"
                onClick={() => props.onFreezePost(tokenId, props.post.chainId)}
                disabled={requiresNetworkSwitch}
                title={interactionDisabledTitle}
              >
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
            <Link className="postImageLink" to={postUrl} state={{ from: props.from, chainId: props.post.chainId ?? null }} aria-label="Open post">
              <video
                className="postImage"
                src={animationSrc}
                poster={imageSrc || undefined}
                controls
                playsInline
                preload="metadata"
                onError={() => {
                  // Only attempt fallback for IPFS URIs and only if we aren't already on fallback.
                  if (!props.post.animationUrl?.startsWith("ipfs://")) return;
                  if (animationSrc.startsWith(fallbackGateway)) return;
                  const next = ipfsToHttpWithGateway(props.post.animationUrl, fallbackGateway);
                  setAnimationSrc(next);
                }}
              />
            </Link>
          ) : props.post.image ? (
            <Link className="postImageLink" to={postUrl} state={{ from: props.from, chainId: props.post.chainId ?? null }} aria-label="Open post">
              <img
                className="postImage"
                src={imageSrc}
                alt="Post image"
                loading="lazy"
                onError={() => {
                  if (!props.post.image?.startsWith("ipfs://")) return;
                  if (imageSrc.startsWith(fallbackGateway)) return;
                  const next = ipfsToHttpWithGateway(props.post.image, fallbackGateway);
                  setImageSrc(next);
                }}
              />
            </Link>
          ) : null}

          {hasMedia ? null : <div className="post-body">{description}</div>}
        </>
      )}

      <div className="postFooter">
        <div className="postStats">
          <button
            className={`statPill statButton${requiresNetworkSwitch ? " notAllowed" : ""} ${props.post.likedByMe ? "isActive isLike" : ""}`}
            type="button"
            onClick={() => props.onAction(tokenId, "like", props.post.chainId)}
            aria-label="Like"
            disabled={requiresNetworkSwitch}
            title={interactionDisabledTitle}
          >
            <IconHeart size={18} filled={!!props.post.likedByMe} />
            <span className="statValue">{props.post.likes}</span>
          </button>

          <button
            className={`statPill statButton${requiresNetworkSwitch ? " notAllowed" : ""} ${props.post.savedByMe ? "isActive isSaved" : ""}`}
            type="button"
            onClick={() => props.onAction(tokenId, "save", props.post.chainId)}
            aria-label="Save"
            disabled={requiresNetworkSwitch}
            title={interactionDisabledTitle}
          >
            <IconBookmark size={18} filled={!!props.post.savedByMe} />
            <span className="statValue">{props.post.saves}</span>
          </button>

          <button
            className={`statPill statButton${requiresNetworkSwitch ? " notAllowed" : ""}`}
            type="button"
            onClick={() => onTogglePanel("comment")}
            aria-label="Comment"
            aria-expanded={props.openPanel === "comment"}
            aria-controls={`comment-${props.post.chainId ?? ""}-${tokenId}`}
            disabled={requiresNetworkSwitch}
            title={interactionDisabledTitle}
          >
            <IconMessage size={18} />
            <span className="statValue">{props.post.comments}</span>
          </button>

          <button
            className={`statPill statButton statTip${requiresNetworkSwitch ? " notAllowed" : ""}`}
            type="button"
            onClick={() => onTogglePanel("tip")}
            aria-label="Tip"
            aria-expanded={props.openPanel === "tip"}
            aria-controls={`tip-${props.post.chainId ?? ""}-${tokenId}`}
            disabled={requiresNetworkSwitch}
            title={interactionDisabledTitle}
          >
            <IconCoin size={18} />
            <span className="statValue">
              {Number(formatEther(props.post.tipsWei)).toFixed(6)} {props.getNativeSymbol(props.chainId)}
            </span>
          </button>
        </div>

        {props.openPanel === "tip" ? (
          <div className="postForm" id={`tip-${props.post.chainId ?? ""}-${tokenId}`}>
            <div className="postFormRow">
              <input
                className="postField"
                type="text"
                value={tipDraft}
                onChange={(event) => setTipDraft(event.target.value)}
                placeholder={`Tip amount in ${props.getNativeSymbol(props.chainId)} (e.g. 0.001)`}
                disabled={requiresNetworkSwitch}
              />
              <button
                className="primary"
                type="button"
                onClick={onSubmitTip}
                disabled={requiresNetworkSwitch}
                title={interactionDisabledTitle}
              >
                Tip
              </button>
            </div>
          </div>
        ) : null}

        {props.openPanel === "comment" ? (
          <div className="postForm" id={`comment-${props.post.chainId ?? ""}-${tokenId}`}>
            <div className="postFormRow">
              <input
                className="postField"
                type="text"
                value={commentDraft}
                onChange={(event) => setCommentDraft(event.target.value)}
                placeholder="Write a comment to sign"
                disabled={requiresNetworkSwitch}
              />
              <button
                className="secondary"
                type="button"
                onClick={onSubmitComment}
                disabled={requiresNetworkSwitch}
                title={interactionDisabledTitle}
              >
                Sign
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {props.isEditing || !hasMedia || !props.post.body?.trim() ? null : (
        <div className="postCaption">{description}</div>
      )}
    </article>
  );
});
