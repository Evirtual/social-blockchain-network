import { memo, useCallback } from "react";

import type { Post } from "@types";
import type { CSSProperties } from "react";
import type { PostPanel } from "./postPanel";
import { requestConnectNudge } from "@shared/lib/connectNudge";
import { PostCommentsModal, PostStatsButtons, PostTipModal, usePostActionPanels } from "./footer/index";
import { useContractState } from "@features/contract/providers/useContractState";
import type { PostActionsController } from "@features/post/types";

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


  avatarStyle?: CSSProperties;
  canModerateComments?: boolean;

  postActions: PostActionsController;
};

export const PostCardFooter = memo(function PostCardFooter(props: PostCardFooterProps) {
  const contractState = useContractState();
  const effectiveDisabledTitle = props.interactionDisabledTitle;

  const tokenId = props.tokenId;
  const postChainId = props.post.chainId ?? null;
  const {
    tipError,
    comments,
    isLoadingComments,
    nativeSymbol,
    tipDraft,
    setTipDraft,
    supportBpsDraft,
    setSupportBpsDraft,
    saveSupportPreference,
    setSaveSupportPreference,
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
    onTip: props.postActions.onTip,
    defaultSupportBps: contractState.tipSupportPreferenceBps,
  });

  const onLike = useCallback(async () => {
    if (inFlight) return;
    if (!props.walletAddress) {
      requestConnectNudge();
      return;
    }
    setInFlight("like");
    try {
      await props.postActions.onAction(tokenId, "like", postChainId);
    } finally {
      setInFlight(null);
    }
  }, [inFlight, props.walletAddress, props.postActions.onAction, tokenId, postChainId]);

  const onSave = useCallback(async () => {
    if (inFlight) return;
    if (!props.walletAddress) {
      requestConnectNudge();
      return;
    }
    setInFlight("save");
    try {
      await props.postActions.onAction(tokenId, "save", postChainId);
    } finally {
      setInFlight(null);
    }
  }, [inFlight, props.walletAddress, props.postActions.onAction, tokenId, postChainId]);

  const canOpenComments = !(props.requiresNetworkSwitch && props.post.comments === 0);

  const onToggleComment = useCallback(() => {
    if (!canOpenComments) return;
    props.onTogglePanel("comment");
  }, [props.onTogglePanel, canOpenComments]);

  const onToggleTip = useCallback(() => {
    if (!props.walletAddress) {
      requestConnectNudge();
      return;
    }
    props.onTogglePanel("tip");
  }, [props.onTogglePanel, props.walletAddress]);

  const isBusy = inFlight !== null;

  return (
    <div className={(`postFooter${props.className ? ` ${props.className}` : ""}`).trim()}>
      <PostStatsButtons
        post={props.post}
        requiresNetworkSwitch={props.requiresNetworkSwitch}
        interactionDisabledTitle={effectiveDisabledTitle}
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
        supportBps={supportBpsDraft}
        onSupportBpsChange={(next) => {
          setSupportBpsDraft(next);
          if (!next) setSaveSupportPreference(false);
        }}
        savePreference={saveSupportPreference}
        onSavePreferenceChange={setSaveSupportPreference}
        onSubmitTip={onSubmitTip}
        tipError={tipError}
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
        allowCommenting={!props.requiresNetworkSwitch && !!props.walletAddress}
        forceReadOnly={!props.walletAddress}
        canModerateComments={props.canModerateComments}
        comments={comments}
        isLoadingComments={isLoadingComments}
        postActions={props.postActions}
      />
    </div>
  );
});
