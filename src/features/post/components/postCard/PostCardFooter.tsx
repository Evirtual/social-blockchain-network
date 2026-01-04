import { memo, useCallback } from "react";

import type { Post } from "@types";
import type { CSSProperties } from "react";
import type { PostPanel } from "../PostCard";
import { requestConnectNudge } from "@shared/lib/connectNudge";
import { PostCommentsModal, PostStatsButtons, PostTipModal, usePostActionPanels } from "./footer/index";
import { useFeedState } from "@features/feed";

export type PostCardFooterProps = {
  className?: string;
  post: Readonly<Post>;
  tokenId: string;

  chainId: string | null;
  walletAddress: string | null;

  requiresNetworkSwitch: boolean;
  interactionDisabledTitle?: string;

  openPanel: PostPanel | null;
  onTogglePanel: (panel: PostPanel) => void;

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

  avatarStyle?: CSSProperties;
  canModerateComments?: boolean;
  shortAddress: (address: string) => string;
  stableHueFromSeed: (seed: string) => number;
  getNativeSymbol: (chainId: string | null) => string;
  getExplorerTxUrl: (chainId: string | null, txHash: string) => string | null;
};

export const PostCardFooter = memo(function PostCardFooter(props: PostCardFooterProps) {
  const feedState = useFeedState();
  const isDemoGated = feedState.isDemoModeEnabled && !feedState.isLiveFeedEnabled;
  const isDemoNotApproved = isDemoGated && feedState.demoStep === "approve";
  const effectiveDisabledTitle = isDemoNotApproved ? "Get approved to interact." : props.interactionDisabledTitle;

  const tokenId = props.tokenId;
  const postChainId = props.post.chainId ?? null;
  const {
    comments,
    isLoadingComments,
    nativeSymbol,
    tipDraft,
    setTipDraft,
    inFlight,
    setInFlight,
    onSubmitTip,
    onCloseComments,
    onCloseTip
  } = usePostActionPanels({
    tokenId,
    postChainId,
    chainId: props.chainId,
    openPanel: props.openPanel,
    onTogglePanel: props.onTogglePanel,
    onTip: props.onTip,
    getNativeSymbol: props.getNativeSymbol
  });

  const onLike = useCallback(async () => {
    if (inFlight) return;
    if (isDemoNotApproved) return;
    if (!props.walletAddress) {
      requestConnectNudge();
      return;
    }
    setInFlight("like");
    try {
      await props.onAction(tokenId, "like", postChainId);
    } finally {
      setInFlight(null);
    }
  }, [inFlight, isDemoNotApproved, props.walletAddress, props.onAction, tokenId, postChainId]);

  const onSave = useCallback(async () => {
    if (inFlight) return;
    if (isDemoNotApproved) return;
    if (!props.walletAddress) {
      requestConnectNudge();
      return;
    }
    setInFlight("save");
    try {
      await props.onAction(tokenId, "save", postChainId);
    } finally {
      setInFlight(null);
    }
  }, [inFlight, isDemoNotApproved, props.walletAddress, props.onAction, tokenId, postChainId]);

  const canOpenComments = !(props.requiresNetworkSwitch && props.post.comments === 0);

  const onToggleComment = useCallback(() => {
    if (!canOpenComments) return;
    props.onTogglePanel("comment");
  }, [props.onTogglePanel, canOpenComments]);

  const onToggleTip = useCallback(() => {
    if (isDemoNotApproved) return;
    if (!props.walletAddress) {
      requestConnectNudge();
      return;
    }
    props.onTogglePanel("tip");
  }, [props.onTogglePanel, props.walletAddress, isDemoNotApproved]);

  const isBusy = inFlight !== null;

  return (
    <div className={(`postFooter${props.className ? ` ${props.className}` : ""}`).trim()}>
      <PostStatsButtons
        post={props.post}
        requiresNetworkSwitch={props.requiresNetworkSwitch}
        interactionDisabledTitle={effectiveDisabledTitle}
        interactionsDisabled={isDemoNotApproved}
        nativeSymbol={nativeSymbol}
        openPanel={props.openPanel}
        isBusy={isBusy}
        inFlight={inFlight}
        canOpenComments={canOpenComments}
        onLike={onLike}
        onSave={onSave}
        onToggleComment={onToggleComment}
        onToggleTip={onToggleTip}
      />

      <PostTipModal
        open={props.openPanel === "tip"}
        avatarStyle={props.avatarStyle}
        tipDraft={tipDraft}
        onTipDraftChange={setTipDraft}
        nativeSymbol={nativeSymbol}
        onSubmitTip={onSubmitTip}
        onClose={onCloseTip}
        requiresNetworkSwitch={props.requiresNetworkSwitch}
        inFlight={inFlight}
        interactionDisabledTitle={effectiveDisabledTitle}
      />

      <PostCommentsModal
        open={props.openPanel === "comment"}
        avatarStyle={props.avatarStyle}
        onClose={onCloseComments}
        tokenId={tokenId}
        postChainId={postChainId}
        chainId={props.chainId}
        walletAddress={props.walletAddress}
        allowCommenting={!props.requiresNetworkSwitch && !!props.walletAddress && !isDemoGated}
        forceReadOnly={isDemoGated || !props.walletAddress}
        disableAuthorProfileLookup={isDemoGated}
        canModerateComments={props.canModerateComments}
        comments={comments}
        isLoadingComments={isLoadingComments}
        onAction={props.onAction}
        onReply={props.onReply}
        onEditComment={props.onEditComment}
        onDeleteComment={props.onDeleteComment}
        onToggleCommentLike={props.onToggleCommentLike}
        onToggleCommentSave={props.onToggleCommentSave}
        onTipComment={props.onTipComment}
        onReportPost={props.onReportPost}
        onReportComment={props.onReportComment}
        shortAddress={props.shortAddress}
        stableHueFromSeed={props.stableHueFromSeed}
        getExplorerTxUrl={props.getExplorerTxUrl}
        getNativeSymbol={props.getNativeSymbol}
      />
    </div>
  );
});
