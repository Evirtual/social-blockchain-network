import { memo, useCallback, useMemo, useState, type MouseEvent } from "react";
import type { Draft, Post } from "@types";
import { Modal } from "@shared/components/Modal";
import { getNetworkBadgeLabel, getNetworkBrandHue, getPostNetworkUi } from "@shared/lib/network";
import { getPostUrl } from "@shared/lib/post";
import { getAvatarStyle, PostCardBody, PostCardEditBox, PostCardFooter, PostCardHeader, PostReportModal } from "./postCard/index";

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
  onTip: (tokenId: string, amountRaw: string, postChainId?: string | null) => Promise<boolean>;
  onReply: (tokenId: string, parentCommentId: string, comment: string, postChainId?: string | null) => Promise<boolean>;
  onEditComment: (tokenId: string, commentId: string, comment: string, postChainId?: string | null) => Promise<boolean>;
  onDeleteComment: (tokenId: string, commentId: string, postChainId?: string | null) => Promise<boolean>;
  onToggleCommentLike: (tokenId: string, commentId: string, postChainId?: string | null) => Promise<boolean>;
  onToggleCommentSave: (tokenId: string, commentId: string, postChainId?: string | null) => Promise<boolean>;
  onTipComment: (tokenId: string, commentId: string, amountRaw: string, postChainId?: string | null) => Promise<boolean>;
  onReportPost: (tokenId: string, reason: string, postChainId?: string | null) => Promise<boolean>;
  onReportComment: (tokenId: string, commentId: string, reason: string, postChainId?: string | null) => Promise<boolean>;
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
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [reportDraft, setReportDraft] = useState("");
  const [isReporting, setIsReporting] = useState(false);

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
  const hasMintTxHash = !!props.post.mintTxHash;

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
        requiresNetworkSwitch={requiresNetworkSwitch}
        postNetworkLabel={postNetworkLabel}
        isCurrentNetworkPost={isCurrentNetworkPost}
        postNetworkTitle={postNetworkTitle}
        postNetworkHue={postNetworkHue}
        postNetworkChainIdNum={postNetworkChainIdNum}
        explorer={explorer}
        hasMintTxHash={hasMintTxHash}
        onCopyMintTx={onCopyMintTx}
        onOpenReport={() => setIsReportOpen(true)}
        onStartEdit={onStartEdit}
        onBurn={onBurn}
      />

      <PostCardBody
        post={props.post}
        postUrl={postUrl}
        postLinkState={postLinkState}
        postChainId={postChainId}
        tokenId={tokenId}
        from={props.from}
        hasMedia={hasMedia}
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
        shortAddress={props.shortAddress}
        stableHueFromSeed={props.stableHueFromSeed}
        getExplorerTxUrl={props.getExplorerTxUrl}
        getNativeSymbol={props.getNativeSymbol}
      />
    </article>
  );
});
