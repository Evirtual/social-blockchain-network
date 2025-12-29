import { memo, useCallback, useEffect, useState } from "react";

import type { Post } from "@types";
import { IconBookmark, IconCoin, IconHeart, IconMessage } from "../../../app";
import type { PostPanel } from "../PostCard";
import { getCommentControlId, getTipControlId } from "./footer/getPanelControlIds";
import { getStatButtonClass } from "./footer/getStatButtonClass";

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

  getNativeSymbol: (chainId: string | null) => string;
};

export const PostCardFooter = memo(function PostCardFooter(props: PostCardFooterProps) {
  const [tipDraft, setTipDraft] = useState<string>("");
  const [commentDraft, setCommentDraft] = useState<string>("");
  const [inFlight, setInFlight] = useState<null | "like" | "save" | "tip" | "comment">(null);

  useEffect(() => {
    setTipDraft("");
    setCommentDraft("");
    setInFlight(null);
  }, [props.tokenId]);

  const onSubmitTip = useCallback(async () => {
    if (inFlight) return;
    setInFlight("tip");
    try {
      const ok = await props.onTip(props.tokenId, tipDraft, props.post.chainId);
      if (ok) setTipDraft("");
    } finally {
      setInFlight(null);
    }
  }, [props, tipDraft, inFlight]);

  const onSubmitComment = useCallback(async () => {
    if (inFlight) return;
    setInFlight("comment");
    try {
      const ok = await props.onAction(props.tokenId, "comment", props.post.chainId, commentDraft);
      if (ok) setCommentDraft("");
    } finally {
      setInFlight(null);
    }
  }, [props, commentDraft, inFlight]);

  const onLike = useCallback(async () => {
    if (inFlight) return;
    setInFlight("like");
    try {
      await props.onAction(props.tokenId, "like", props.post.chainId);
    } finally {
      setInFlight(null);
    }
  }, [props, inFlight]);

  const onSave = useCallback(async () => {
    if (inFlight) return;
    setInFlight("save");
    try {
      await props.onAction(props.tokenId, "save", props.post.chainId);
    } finally {
      setInFlight(null);
    }
  }, [props, inFlight]);

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
          onClick={() => props.onTogglePanel("comment")}
          aria-label="Comment"
          aria-expanded={props.openPanel === "comment"}
          aria-controls={getCommentControlId(props.post.chainId, props.tokenId)}
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
          onClick={() => props.onTogglePanel("tip")}
          aria-label="Tip"
          aria-expanded={props.openPanel === "tip"}
          aria-controls={getTipControlId(props.post.chainId, props.tokenId)}
          disabled={props.requiresNetworkSwitch || isBusy}
          title={props.interactionDisabledTitle}
        >
          <IconCoin size={18} />
          <span className="postActionCount">
            {props.getNativeSymbol(props.chainId)}
          </span>
        </button>
      </div>

      {props.openPanel === "tip" ? (
        <div className="postForm" id={getTipControlId(props.post.chainId, props.tokenId)}>
          <div className="postFormRow">
            <input
              className="postField"
              type="text"
              value={tipDraft}
              onChange={(event) => setTipDraft(event.target.value)}
              placeholder={`Tip amount in ${props.getNativeSymbol(props.chainId)} (e.g. 0.001)`}
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
      ) : null}

      {props.openPanel === "comment" ? (
        <div className="postForm" id={getCommentControlId(props.post.chainId, props.tokenId)}>
          <div className="postFormRow">
            <input
              className="postField"
              type="text"
              value={commentDraft}
              onChange={(event) => setCommentDraft(event.target.value)}
              placeholder="Write a comment to sign"
              disabled={props.requiresNetworkSwitch || inFlight === "comment"}
            />
            <button
              className={"secondary buttonWithSpinner"}
              type="button"
              onClick={onSubmitComment}
              disabled={props.requiresNetworkSwitch || inFlight === "comment"}
              title={props.interactionDisabledTitle}
            >
              {inFlight === "comment" ? <span className="spinner" aria-hidden="true" /> : null}
              Sign
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
});
