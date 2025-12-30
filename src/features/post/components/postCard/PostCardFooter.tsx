import { memo, useCallback, useEffect, useMemo, useState } from "react";

import type { Post } from "@types";
import { IconBookmark, IconCoin, IconHeart, IconMessage, Modal } from "@features/app";
import { commentKey, useFeedActions, useFeedState } from "@features/feed";
import type { CSSProperties } from "react";
import type { PostPanel } from "../PostCard";
import { getStatButtonClass } from "./footer/getStatButtonClass";
import { CommentsCard } from "../CommentsCard";

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
  const nativeSymbol = useMemo(
    () => props.getNativeSymbol(postChainId ?? props.chainId),
    [props.getNativeSymbol, postChainId, props.chainId]
  );
  const commentsKey = useMemo(() => commentKey(postChainId, tokenId), [postChainId, tokenId]);

  const [tipDraft, setTipDraft] = useState<string>("");
  const [inFlight, setInFlight] = useState<null | "like" | "save" | "tip">(null);

  const feedState = useFeedState();
  const feedActions = useFeedActions();
  const comments = feedState.postComments[commentsKey] ?? [];
  const isLoadingComments = !!feedState.isLoadingPostComments[commentsKey];

  useEffect(() => {
    setTipDraft("");
    setInFlight(null);
  }, [tokenId]);

  useEffect(() => {
    if (props.openPanel !== "comment") return;
    void feedActions.loadCommentsForPost(tokenId, postChainId);
  }, [props.openPanel, feedActions, tokenId, postChainId]);

  const onSubmitTip = useCallback(async () => {
    if (inFlight) return;
    setInFlight("tip");
    try {
      const ok = await props.onTip(tokenId, tipDraft, postChainId);
      if (ok) setTipDraft("");
    } finally {
      setInFlight(null);
    }
  }, [inFlight, props.onTip, tokenId, tipDraft, postChainId]);

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

  const onToggleComment = useCallback(() => {
    props.onTogglePanel("comment");
  }, [props.onTogglePanel]);

  const onToggleTip = useCallback(() => {
    props.onTogglePanel("tip");
  }, [props.onTogglePanel]);

  const onCloseComments = useCallback(() => {
    props.onTogglePanel("comment");
  }, [props.onTogglePanel]);

  const onCloseTip = useCallback(() => {
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
          className={getStatButtonClass({ requiresNetworkSwitch: props.requiresNetworkSwitch })}
          type="button"
          onClick={onToggleComment}
          aria-label="Comment"
          aria-expanded={props.openPanel === "comment"}
          disabled={props.requiresNetworkSwitch || isBusy}
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
