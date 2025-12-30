import { memo, useCallback, useMemo, type MouseEvent } from "react";
import { Link } from "react-router-dom";
import type { Draft, Post } from "@types";
import { ChainLogo, IconEdit, IconFlame, Modal } from "@features/app";
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

  shortAddress: (address: string) => string;
  stableHueFromSeed: (seed: string) => number;
  getNativeSymbol: (chainId: string | null) => string;
  getExplorerTxUrl: (chainId: string | null, txHash: string) => string | null;
};

export const PostCard = memo(function PostCard(props: Props) {
  const tokenId = props.post.tokenId;
  const postChainId = props.post.chainId ?? null;

  const hasMedia = useMemo(() => !!props.post.image || !!props.post.animationUrl, [props.post.image, props.post.animationUrl]);

  const explorer = useMemo(() => {
    if (!props.post.mintTxHash) return null;
    return props.getExplorerTxUrl(postChainId ?? props.chainId, props.post.mintTxHash);
  }, [props.post.mintTxHash, props.getExplorerTxUrl, postChainId, props.chainId]);

  const postUrl = useMemo(() => getPostUrl(postChainId, tokenId), [postChainId, tokenId]);
  const postLinkState = useMemo(() => ({ from: props.from, chainId: postChainId }), [props.from, postChainId]);

  const avatarStyle = useMemo(
    () => getAvatarStyle({ authorAvatarUrl: props.authorAvatarUrl, authorHue: props.authorHue }),
    [props.authorAvatarUrl, props.authorHue]
  );

  const { postNetworkLabel, isCurrentNetworkPost, requiresNetworkSwitch, interactionDisabledTitle } = useMemo(() => {
    return getPostNetworkUi({
      postChainId,
      chainId: props.chainId,
      walletAddress: props.walletAddress
    });
  }, [postChainId, props.chainId, props.walletAddress]);

  const postNetworkTitle = useMemo(() => (postChainId ? getNetworkBadgeLabel(postChainId) : ""), [postChainId]);
  const postNetworkHue = useMemo(() => (postChainId ? getNetworkBrandHue(postChainId) : 210), [postChainId]);
  const postNetworkChainIdNum = useMemo(() => (postChainId ? Number(postChainId) : NaN), [postChainId]);

  const onTogglePanel = useCallback(
    (panel: PostPanel) => {
      props.togglePanel(props.panelKey, panel);
    },
    [props.togglePanel, props.panelKey]
  );

  const onStartEdit = useCallback(() => {
    props.onStartEditPost(props.post);
  }, [props.onStartEditPost, props.post]);

  const onBurn = useCallback(() => {
    props.onBurn(tokenId, postChainId);
  }, [props.onBurn, tokenId, postChainId]);

  const onCopyMintTx = useCallback(
    (event: MouseEvent<HTMLAnchorElement>) => {
      if (explorer) return;
      event.preventDefault();
      if (props.post.mintTxHash) {
        void navigator.clipboard?.writeText(props.post.mintTxHash);
      }
    },
    [explorer, props.post.mintTxHash]
  );

  return (
    <article className="post" style={{ animationDelay: `${props.animationDelayMs ?? 0}ms` }}>
      <Modal
        open={props.isEditing}
        title="Edit post"
        headerLeading={<div className="avatar small" style={avatarStyle} />}
        onClose={props.onCancelEditPost}
      >
        <PostCardEditBox
          tokenId={tokenId}
          postChainId={postChainId}
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
          canModerate={props.canModerate}
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
              {postNetworkLabel ? (
                props.post.mintTxHash ? (
                  <a
                    className={`postNetworkMarkLink ${isCurrentNetworkPost ? "isCurrentNetwork" : ""}`}
                    href={explorer ?? "#"}
                    target={explorer ? "_blank" : undefined}
                    rel={explorer ? "noreferrer" : undefined}
                    aria-label={postNetworkTitle ? `Network: ${postNetworkTitle}` : "Network"}
                    title={postNetworkTitle || (explorer ? "View mint transaction" : "Copy mint transaction hash")}
                    onClick={onCopyMintTx}
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
                    onClick={onStartEdit}
                    aria-label="Edit post"
                    title="Edit"
                    disabled={requiresNetworkSwitch}
                  >
                    <IconEdit size={16} />
                  </button>
                  <button
                    className={`danger iconButton${requiresNetworkSwitch ? " notAllowed" : ""}`}
                    type="button"
                    onClick={onBurn}
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
            <Link className="postBodyLink" to={postUrl} state={postLinkState} aria-label="Open post">
              <div className="postText">
                <p>{props.post.body}</p>
              </div>
            </Link>
          </div>
        ) : null}

        {hasMedia ? (
          <PostCardMedia
            postUrl={postUrl}
            from={props.from}
            postChainId={postChainId}
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
          avatarStyle={avatarStyle}
          shortAddress={props.shortAddress}
          stableHueFromSeed={props.stableHueFromSeed}
          getExplorerTxUrl={props.getExplorerTxUrl}
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
