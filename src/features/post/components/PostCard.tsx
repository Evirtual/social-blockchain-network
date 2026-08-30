import type { TipOutcome } from "@features/social/services/postActions/tipOutcome";
import { memo, useCallback, useMemo, useState, type MouseEvent } from "react";
import type { Draft, Post } from "@types";
import { Modal } from "@shared/components/Modal";
import { getNetworkBadgeLabel, getNetworkBrandHue, getPostNetworkUi } from "@shared/lib/network";
import { getPostUrl } from "@features/post/services";
import { useStatusActions } from "@features/status";
import { runSocialAction } from "@features/social/services/actions/runSocialAction";
import { getAvatarStyle, PostBurnModal, PostCardBody, PostCardEditBox, PostCardFooter, PostCardHeader, PostReportModal } from "./postCard/index";
import { requestConnectNudge } from "@shared/lib/connectNudge";
import { getExplorerTxUrl } from "@shared/lib/chain";

export type PostPanel = "comment" | "tip";

type Props = {
  post: Readonly<Post>;
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

  onStartEditPost: (post: Readonly<Post>) => void;
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
  onTip: (
    tokenId: string,
    amountRaw: string,
    postChainId?: string | null,
    supportBps?: number | null,
    savePreference?: boolean
  ) => Promise<TipOutcome>;
  onReply: (tokenId: string, parentCommentId: string, comment: string, postChainId?: string | null) => Promise<boolean>;
  onEditComment: (tokenId: string, commentId: string, comment: string, postChainId?: string | null) => Promise<boolean>;
  onDeleteComment: (tokenId: string, commentId: string, postChainId?: string | null) => Promise<boolean>;
  onToggleCommentLike: (tokenId: string, commentId: string, postChainId?: string | null) => Promise<boolean>;
  onToggleCommentSave: (tokenId: string, commentId: string, postChainId?: string | null) => Promise<boolean>;
  onTipComment: (
    tokenId: string,
    commentId: string,
    amountRaw: string,
    postChainId?: string | null,
    supportBps?: number | null,
    savePreference?: boolean
  ) => Promise<boolean>;
  onReportPost: (tokenId: string, reason: string, postChainId?: string | null) => Promise<boolean>;
  onReportComment: (tokenId: string, commentId: string, reason: string, postChainId?: string | null) => Promise<boolean>;
  onBurn: (tokenId: string, postChainId?: string | null) => void | Promise<void>;
  onFreezePost: (tokenId: string, postChainId?: string | null) => void;

};

export const PostCard = memo(function PostCard(props: Props) {

  const tokenId = props.post.tokenId;
  const postChainId = props.post.chainId ?? null;
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [reportDraft, setReportDraft] = useState("");
  const [isReporting, setIsReporting] = useState(false);
  const [isBurning, setIsBurning] = useState(false);
  const [isBurnConfirmOpen, setIsBurnConfirmOpen] = useState(false);

  const { setStatus } = useStatusActions();

  const hasMedia = useMemo(() => !!props.post.image || !!props.post.animationUrl, [props.post.image, props.post.animationUrl]);

  const explorer = useMemo(() => {
    if (!props.post.mintTxHash) return null;
    return getExplorerTxUrl(postChainId ?? props.chainId, props.post.mintTxHash);
  }, [props.post.mintTxHash, postChainId, props.chainId]);

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
  const hasMintTxHash = !!props.post.mintTxHash;

  const onTogglePanel = useCallback(
    (panel: PostPanel) => {
      if (!props.walletAddress && panel === "comment") {
        props.togglePanel(props.panelKey, panel);
        return;
      }
      void runSocialAction<void>({
        walletAddress: props.walletAddress,
        setStatus,
        action: async () => {
          props.togglePanel(props.panelKey, panel);
        }
      });
    },
    [props.togglePanel, props.panelKey, props.walletAddress, setStatus]
  );

  const onOpenReport = useCallback(() => {
    if (!props.walletAddress) {
      requestConnectNudge();
      return;
    }
    setIsReportOpen(true);
  }, [props.walletAddress]);

  const onStartEdit = useCallback(() => {
    props.onStartEditPost(props.post);
  }, [props.onStartEditPost, props.post]);

  // The header icon only asks; nothing is destroyed until the dialog confirms.
  const onRequestBurn = useCallback(() => {
    if (isBurning) return;
    setIsBurnConfirmOpen(true);
  }, [isBurning]);

  const onConfirmBurn = useCallback(async () => {
    if (isBurning) return;
    setIsBurning(true);
    try {
      await props.onBurn(tokenId, postChainId);
      setIsBurnConfirmOpen(false);
    } finally {
      setIsBurning(false);
    }
  }, [props.onBurn, tokenId, postChainId, isBurning]);

  const onSubmitReport = useCallback(async () => {
    if (isReporting) return;
    setIsReporting(true);
    try {
      const ok = await props.onReportPost(tokenId, reportDraft, postChainId);
      if (ok) {
        setReportDraft("");
        setIsReportOpen(false);
      }
    } finally {
      setIsReporting(false);
    }
  }, [isReporting, props.onReportPost, tokenId, reportDraft, postChainId]);

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
        headerTrailing={
          props.isMine || props.canModerate ? (
            <button
              type="button"
              className="ghost iconButton modalFreezeButton"
              onClick={() => props.onFreezePost(tokenId, postChainId)}
              disabled={requiresNetworkSwitch}
              title={interactionDisabledTitle || "Freeze post"}
              aria-label="Freeze post"
            >
              <span aria-hidden="true">🧊</span>
            </button>
          ) : null
        }
        onClose={props.onCancelEditPost}
      >
        <PostCardEditBox
          tokenId={tokenId}
          postChainId={postChainId}
          existingIsVideo={Boolean(props.post.animationUrl)}
          originalBody={props.post.body}
          originalMediaUrl={props.post.animationUrl ?? props.post.image}
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
      <PostBurnModal
        open={isBurnConfirmOpen}
        avatarStyle={avatarStyle}
        postBody={props.post.body ?? ""}
        onConfirm={onConfirmBurn}
        onClose={() => setIsBurnConfirmOpen(false)}
        isBurning={isBurning}
        requiresNetworkSwitch={requiresNetworkSwitch}
        interactionDisabledTitle={interactionDisabledTitle}
      />
      <PostReportModal
        open={isReportOpen}
        avatarStyle={avatarStyle}
        reportDraft={reportDraft}
        onReportDraftChange={setReportDraft}
        onSubmit={onSubmitReport}
        onClose={() => setIsReportOpen(false)}
        isReporting={isReporting}
        requiresNetworkSwitch={requiresNetworkSwitch}
        interactionDisabledTitle={interactionDisabledTitle}
      />

      <PostCardHeader
        author={props.post.author}
        authorLabel={props.authorLabel}
        avatarStyle={avatarStyle}
        isMine={props.isMine}
        canModerate={props.canModerate}
        isEditing={props.isEditing}
        isBurning={isBurning}
        requiresNetworkSwitch={requiresNetworkSwitch}
        postNetworkLabel={postNetworkLabel}
        isCurrentNetworkPost={isCurrentNetworkPost}
        postNetworkTitle={postNetworkTitle}
        postNetworkHue={postNetworkHue}
        postNetworkChainIdNum={postNetworkChainIdNum}
        explorer={explorer}
        hasMintTxHash={hasMintTxHash}
        onCopyMintTx={onCopyMintTx}
        onOpenReport={onOpenReport}
        onStartEdit={onStartEdit}
        onBurn={onRequestBurn}
      />

      <PostCardBody
        post={props.post}
        postUrl={postUrl}
        postLinkState={postLinkState}
        postChainId={postChainId}
        tokenId={tokenId}
        from={props.from}
        hasMedia={hasMedia}
        showCaption={!hasMedia}
      />

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
        onReply={props.onReply}
        onEditComment={props.onEditComment}
        onDeleteComment={props.onDeleteComment}
        onToggleCommentLike={props.onToggleCommentLike}
        onToggleCommentSave={props.onToggleCommentSave}
        onTipComment={props.onTipComment}
        onReportPost={props.onReportPost}
        onReportComment={props.onReportComment}
        avatarStyle={avatarStyle}
        canModerateComments={props.isMine || props.canModerate}
      />

      {hasMedia && !!props.post.body?.trim() ? (
        <div className="postCaption">
          <div className="postText">
            <p>{props.post.body}</p>
          </div>
        </div>
      ) : null}
    </article>
  );
});
