import { memo, useCallback, useMemo, useState, type MouseEvent } from "react";
import type { Post } from "@types";
import { Modal } from "@shared/components/Modal";
import { getNetworkBadgeLabel, getNetworkBrandHue, getPostNetworkUi } from "@shared/lib/network";
import { getPostUrl } from "@features/post/services";
import { useStatusActions } from "@features/status";
import { runSocialAction } from "@features/social/services/actions/runSocialAction";
import { getAvatarStyle } from "./postCard/postCardDerived";
import { PostBurnModal } from "./postCard/PostBurnModal";
import { PostCardBody } from "./postCard/PostCardBody";
import { PostCardEditBox } from "./postCard/PostCardEditBox";
import { PostCardFooter } from "./postCard/PostCardFooter";
import { PostCardHeader } from "./postCard/PostCardHeader";
import { PostReportModal } from "./postCard/PostReportModal";
import { requestConnectNudge } from "@shared/lib/connectNudge";
import { getExplorerTxUrl } from "@shared/lib/chain";

import type { PostPanel } from "./postCard/postPanel";
import type { PostActionsController } from "@features/post/types";

export type { PostPanel } from "./postCard/postPanel";

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


  openPanel: PostPanel | null;
  panelKey: string;
  togglePanel: (id: string, panel: PostPanel) => void;

  /** Every post action, as one object. It is built once by
   * usePostActionsController and was previously unpacked into 20 props. */
  postActions: PostActionsController;
};

export const PostCard = memo(function PostCard(props: Props) {

  const actions = props.postActions;
  const isEditing = actions.editingTokenId === props.panelKey;
  const editDraft = isEditing ? actions.editDraft : null;
  const isEditImageLoading = isEditing ? actions.isEditImageLoading : false;

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
    actions.onStartEditPost(props.post);
  }, [actions.onStartEditPost, props.post]);

  // The header icon only asks; nothing is destroyed until the dialog confirms.
  const onRequestBurn = useCallback(() => {
    if (isBurning) return;
    setIsBurnConfirmOpen(true);
  }, [isBurning]);

  const onConfirmBurn = useCallback(async () => {
    if (isBurning) return;
    setIsBurning(true);
    try {
      await actions.onBurn(tokenId, postChainId);
      setIsBurnConfirmOpen(false);
    } finally {
      setIsBurning(false);
    }
  }, [actions.onBurn, tokenId, postChainId, isBurning]);

  const onSubmitReport = useCallback(async () => {
    if (isReporting) return;
    setIsReporting(true);
    try {
      const ok = await actions.reportPost(tokenId, reportDraft, postChainId);
      if (ok) {
        setReportDraft("");
        setIsReportOpen(false);
      }
    } finally {
      setIsReporting(false);
    }
  }, [isReporting, actions.reportPost, tokenId, reportDraft, postChainId]);

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
        open={isEditing}
        title="Edit post"
        headerLeading={<div className="avatar small" style={avatarStyle} />}
        headerTrailing={
          props.isMine || props.canModerate ? (
            <button
              type="button"
              className="ghost iconButton modalFreezeButton"
              onClick={() => actions.onFreezePost(tokenId, postChainId)}
              disabled={requiresNetworkSwitch}
              title={interactionDisabledTitle || "Freeze post"}
              aria-label="Freeze post"
            >
              <span aria-hidden="true">🧊</span>
            </button>
          ) : null
        }
        onClose={actions.onCancelEditPost}
      >
        <PostCardEditBox
          tokenId={tokenId}
          postChainId={postChainId}
          existingIsVideo={Boolean(props.post.animationUrl)}
          originalBody={props.post.body}
          originalMediaUrl={props.post.animationUrl ?? props.post.image}
          requiresNetworkSwitch={requiresNetworkSwitch}
          interactionDisabledTitle={interactionDisabledTitle}
          editDraft={editDraft}
          isEditImageLoading={isEditImageLoading}
          onSetEditDraft={actions.onSetEditDraft}
          onCancelEditPost={actions.onCancelEditPost}
          onSaveEditedPost={actions.onSaveEditedPost}
          onEditSelectFile={actions.onEditSelectFile}
          onEditClearImage={actions.onEditClearImage}
          onFreezePost={actions.onFreezePost}
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
        isEditing={isEditing}
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
        postActions={props.postActions}
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
