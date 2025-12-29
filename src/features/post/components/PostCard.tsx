import { memo, useCallback } from "react";
import { Link } from "react-router-dom";
import type { Draft, Post } from "@types";
import { ChainLogo, IconEdit, IconFlame, Modal } from "../../app";
import { getNetworkBadgeLabel, getNetworkBrandHue } from "@shared/lib/chain";
import { PostCardEditBox } from "./postCard/PostCardEditBox";
import { PostCardFooter } from "./postCard/PostCardFooter";
import { PostCardMedia } from "./postCard/PostCardMedia";
import { getAvatarStyle, getPostNetworkUi, getPostUrl } from "./postCard/postCardDerived";

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
  onSaveEditedPost: () => Promise<void>;
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
  const hasMedia = !!props.post.image || !!props.post.animationUrl;
  const explorer = props.post.mintTxHash
    ? props.getExplorerTxUrl(props.post.chainId ?? props.chainId, props.post.mintTxHash)
    : null;
  const postUrl = getPostUrl(props.post.chainId, tokenId);
  const avatarStyle = getAvatarStyle({ authorAvatarUrl: props.authorAvatarUrl, authorHue: props.authorHue });

  const { postNetworkLabel, isCurrentNetworkPost, requiresNetworkSwitch, interactionDisabledTitle } = getPostNetworkUi({
    postChainId: props.post.chainId,
    chainId: props.chainId,
    walletAddress: props.walletAddress
  });

  const postNetworkTitle = props.post.chainId ? getNetworkBadgeLabel(props.post.chainId) : "";
  const postNetworkHue = props.post.chainId ? getNetworkBrandHue(props.post.chainId) : 210;
  const postNetworkChainIdNum = props.post.chainId ? Number(props.post.chainId) : NaN;

  const onTogglePanel = useCallback(
    (panel: PostPanel) => {
      props.togglePanel(props.panelKey, panel);
    },
    [props.togglePanel, props.panelKey]
  );

  return (
    <article className="post" style={{ animationDelay: `${props.animationDelayMs ?? 0}ms` }}>
      <Modal open={props.isEditing} title="Edit post" onClose={props.onCancelEditPost}>
        <PostCardEditBox
          tokenId={tokenId}
          postChainId={props.post.chainId}
          avatarStyle={avatarStyle}
          requiresNetworkSwitch={requiresNetworkSwitch}
          interactionDisabledTitle={interactionDisabledTitle}
          editDraft={props.editDraft}
          isEditImageLoading={props.isEditImageLoading}
          onSetEditDraft={props.onSetEditDraft}
          onCancelEditPost={props.onCancelEditPost}
          onSaveEditedPost={props.onSaveEditedPost}
          onEditSelectFile={props.onEditSelectFile}
          onEditClearImage={props.onEditClearImage}
          onFreezePost={props.onFreezePost}
          isMine={props.isMine}
        />
      </Modal>

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
                    className={`postNetworkMarkLink ${isCurrentNetworkPost ? "isCurrentNetwork" : ""}`}
                    href={explorer ?? "#"}
                    target={explorer ? "_blank" : undefined}
                    rel={explorer ? "noreferrer" : undefined}
                    aria-label={postNetworkTitle ? `Network: ${postNetworkTitle}` : "Network"}
                    title={postNetworkTitle || (explorer ? "View mint transaction" : "Copy mint transaction hash")}
                    onClick={(e) => {
                      if (explorer) return;
                      e.preventDefault();
                      if (props.post.mintTxHash) {
                        void navigator.clipboard?.writeText(props.post.mintTxHash);
                      }
                    }}
                  >
                    <span
                      className="chainBrandMark"
                      style={{ ["--brand-hue" as any]: postNetworkHue }}
                      aria-hidden="true"
                    >
                      <ChainLogo chainId={postNetworkChainIdNum} size={20} />
                    </span>
                  </a>
                ) : (
                  <span
                    className={`postNetworkMarkLink ${isCurrentNetworkPost ? "isCurrentNetwork" : ""}`}
                    aria-label={postNetworkTitle ? `Network: ${postNetworkTitle}` : "Network"}
                    title={postNetworkTitle}
                  >
                    <span
                      className="chainBrandMark"
                      style={{ ["--brand-hue" as any]: postNetworkHue }}
                      aria-hidden="true"
                    >
                      <ChainLogo chainId={postNetworkChainIdNum} size={20} />
                    </span>
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

      <>
        {!hasMedia && !!props.post.body?.trim() ? (
          <div className="post-body">
            <div className="postText">
              <p>{props.post.body}</p>
            </div>
          </div>
        ) : null}

        {hasMedia ? (
          <PostCardMedia
            postUrl={postUrl}
            from={props.from}
            postChainId={props.post.chainId ?? null}
            tokenId={tokenId}
            body={props.post.body}
            image={props.post.image}
            animationUrl={props.post.animationUrl}
            showBody={false}
          />
        ) : null}

        <PostCardFooter
          className={hasMedia ? "afterMedia" : undefined}
          post={props.post}
          tokenId={tokenId}
          chainId={props.chainId}
          walletAddress={props.walletAddress}
          requiresNetworkSwitch={requiresNetworkSwitch}
          interactionDisabledTitle={interactionDisabledTitle}
          openPanel={props.openPanel}
          onTogglePanel={onTogglePanel}
          onAction={props.onAction}
          onTip={props.onTip}
          getNativeSymbol={props.getNativeSymbol}
        />

        {hasMedia && !!props.post.body?.trim() ? (
          <div className="postCaption">
            <div className="postText">
              <p>{props.post.body}</p>
            </div>
          </div>
        ) : null}
      </>
    </article>
  );
});
