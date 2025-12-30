import { memo, useCallback } from "react";

import type { Post } from "@types";
import { IconBookmark, IconCoin, IconHeart, IconMessage, Modal } from "@features/app";
import type { CSSProperties } from "react";
import type { PostPanel } from "../PostCard";
import { getStatButtonClass } from "./footer/getStatButtonClass";
import { CommentsCard } from "../CommentsCard";
import { usePostActionPanels } from "./footer/usePostActionPanels";

export type PostCardFooterProps = {
  className?: string;
  post: Post;
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

  avatarStyle?: CSSProperties;
  shortAddress: (address: string) => string;
  stableHueFromSeed: (seed: string) => number;
  getNativeSymbol: (chainId: string | null) => string;
  getExplorerTxUrl: (chainId: string | null, txHash: string) => string | null;
};

export const PostCardFooter = memo(function PostCardFooter(props: PostCardFooterProps) {
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
    setInFlight("like");
    try {
      await props.onAction(tokenId, "like", postChainId);
    } finally {
      setInFlight(null);
    }
  }, [inFlight, props.onAction, tokenId, postChainId]);

  const onSave = useCallback(async () => {
    if (inFlight) return;
    setInFlight("save");
    try {
      await props.onAction(tokenId, "save", postChainId);
    } finally {
      setInFlight(null);
    }
  }, [inFlight, props.onAction, tokenId, postChainId]);

  const canOpenComments = !(props.requiresNetworkSwitch && props.post.comments === 0);

  const onToggleComment = useCallback(() => {
    if (!canOpenComments) return;
    props.onTogglePanel("comment");
  }, [props.onTogglePanel, canOpenComments]);

  const onToggleTip = useCallback(() => {
    props.onTogglePanel("tip");
  }, [props.onTogglePanel]);

  const isBusy = inFlight !== null;

  return (
    <div className={(`postFooter${props.className ? ` ${props.className}` : ""}`).trim()}>
      <div className="postStats">
        <button
          className={getStatButtonClass({
            requiresNetworkSwitch: props.requiresNetworkSwitch,
            active: props.post.likedByMe ? "isActive isLike" : ""
          })}
          type="button"
          onClick={onLike}
          aria-label="Like"
          aria-busy={inFlight === "like"}
          disabled={props.requiresNetworkSwitch || isBusy}
          title={props.interactionDisabledTitle}
        >
          <IconHeart size={18} filled={!!props.post.likedByMe} />
          <span className="postActionCount">{props.post.likes}</span>
        </button>

        <button
          className={getStatButtonClass({
            requiresNetworkSwitch: props.requiresNetworkSwitch,
            active: props.post.savedByMe ? "isActive isSaved" : ""
          })}
          type="button"
          onClick={onSave}
          aria-label="Save"
          aria-busy={inFlight === "save"}
          disabled={props.requiresNetworkSwitch || isBusy}
          title={props.interactionDisabledTitle}
        >
          <IconBookmark size={18} filled={!!props.post.savedByMe} />
          <span className="postActionCount">{props.post.saves}</span>
        </button>

        <button
          className={getStatButtonClass({ requiresNetworkSwitch: false })}
          type="button"
          onClick={onToggleComment}
          aria-label="Comment"
          aria-expanded={props.openPanel === "comment"}
          disabled={isBusy || !canOpenComments}
          title={props.interactionDisabledTitle}
        >
          <IconMessage size={18} />
          <span className="postActionCount">{props.post.comments}</span>
        </button>

        <button
          className={getStatButtonClass({
            requiresNetworkSwitch: props.requiresNetworkSwitch
          })}
          type="button"
          onClick={onToggleTip}
          aria-label="Tip"
          aria-expanded={props.openPanel === "tip"}
          disabled={props.requiresNetworkSwitch || isBusy}
          title={props.interactionDisabledTitle}
        >
          <IconCoin size={18} />
          <span className="postActionCount">{nativeSymbol}</span>
        </button>
      </div>

      <Modal
        open={props.openPanel === "tip"}
        title="Tip"
        headerLeading={<div className="avatar small" style={props.avatarStyle} />}
        onClose={onCloseTip}
      >
        <div className="postForm">
          <div className="postFormRow">
            <input
              className="postField"
              type="text"
              value={tipDraft}
              onChange={(event) => setTipDraft(event.target.value)}
              placeholder={`Tip amount in ${nativeSymbol} (e.g. 0.001)`}
              disabled={props.requiresNetworkSwitch || inFlight === "tip"}
            />
            <button
              className={"secondary buttonWithSpinner"}
              type="button"
              onClick={onSubmitTip}
              disabled={props.requiresNetworkSwitch || inFlight === "tip"}
              title={props.interactionDisabledTitle}
            >
              {inFlight === "tip" ? <span className="spinner" aria-hidden="true" /> : null}
              Tip
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={props.openPanel === "comment"}
        title="Comments"
        headerLeading={<div className="avatar small" style={props.avatarStyle} />}
        onClose={onCloseComments}
      >
        <CommentsCard
          tokenId={tokenId}
          postChainId={postChainId}
          chainId={props.chainId}
          walletAddress={props.walletAddress}
          useCardWrapper={false}
          allowCommenting={!props.requiresNetworkSwitch}
          comments={comments}
          isLoadingComments={isLoadingComments}
          onAction={props.onAction}
          shortAddress={props.shortAddress}
          stableHueFromSeed={props.stableHueFromSeed}
          getExplorerTxUrl={props.getExplorerTxUrl}
        />
      </Modal>
    </div>
  );
});
