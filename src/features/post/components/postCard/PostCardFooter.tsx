import { memo, useCallback, useEffect, useState } from "react";

import type { Post } from "@types";
import { IconBookmark, IconCoin, IconHeart, IconMessage } from "../../../app";
import type { PostPanel } from "../PostCard";
import { formatTipsWei } from "./footer/formatTips";
import { getCommentControlId, getTipControlId } from "./footer/getPanelControlIds";
import { getStatButtonClass } from "./footer/getStatButtonClass";

export type PostCardFooterProps = {
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

  useEffect(() => {
    setTipDraft("");
    setCommentDraft("");
  }, [props.tokenId]);

  const onSubmitTip = useCallback(async () => {
    const ok = await props.onTip(props.tokenId, tipDraft, props.post.chainId);
    if (ok) setTipDraft("");
  }, [props, tipDraft]);

  const onSubmitComment = useCallback(async () => {
    const ok = await props.onAction(props.tokenId, "comment", props.post.chainId, commentDraft);
    if (ok) setCommentDraft("");
  }, [props, commentDraft]);

  return (
    <div className="postFooter">
      <div className="postStats">
        <button
          className={getStatButtonClass({
            requiresNetworkSwitch: props.requiresNetworkSwitch,
            active: props.post.likedByMe ? "isActive isLike" : ""
          })}
          type="button"
          onClick={() => props.onAction(props.tokenId, "like", props.post.chainId)}
          aria-label="Like"
          disabled={props.requiresNetworkSwitch}
          title={props.interactionDisabledTitle}
        >
          <IconHeart size={18} filled={!!props.post.likedByMe} />
          <span className="statValue">{props.post.likes}</span>
        </button>

        <button
          className={getStatButtonClass({
            requiresNetworkSwitch: props.requiresNetworkSwitch,
            active: props.post.savedByMe ? "isActive isSaved" : ""
          })}
          type="button"
          onClick={() => props.onAction(props.tokenId, "save", props.post.chainId)}
          aria-label="Save"
          disabled={props.requiresNetworkSwitch}
          title={props.interactionDisabledTitle}
        >
          <IconBookmark size={18} filled={!!props.post.savedByMe} />
          <span className="statValue">{props.post.saves}</span>
        </button>

        <button
          className={getStatButtonClass({ requiresNetworkSwitch: props.requiresNetworkSwitch })}
          type="button"
          onClick={() => props.onTogglePanel("comment")}
          aria-label="Comment"
          aria-expanded={props.openPanel === "comment"}
          aria-controls={getCommentControlId(props.post.chainId, props.tokenId)}
          disabled={props.requiresNetworkSwitch}
          title={props.interactionDisabledTitle}
        >
          <IconMessage size={18} />
          <span className="statValue">{props.post.comments}</span>
        </button>

        <button
          className={getStatButtonClass({
            requiresNetworkSwitch: props.requiresNetworkSwitch,
            extra: "statTip"
          })}
          type="button"
          onClick={() => props.onTogglePanel("tip")}
          aria-label="Tip"
          aria-expanded={props.openPanel === "tip"}
          aria-controls={getTipControlId(props.post.chainId, props.tokenId)}
          disabled={props.requiresNetworkSwitch}
          title={props.interactionDisabledTitle}
        >
          <IconCoin size={18} />
          <span className="statValue">
            {formatTipsWei({ tipsWei: props.post.tipsWei, nativeSymbol: props.getNativeSymbol(props.chainId) })}
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
              disabled={props.requiresNetworkSwitch}
            />
            <button
              className="primary"
              type="button"
              onClick={onSubmitTip}
              disabled={props.requiresNetworkSwitch}
              title={props.interactionDisabledTitle}
            >
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
              disabled={props.requiresNetworkSwitch}
            />
            <button
              className="secondary"
              type="button"
              onClick={onSubmitComment}
              disabled={props.requiresNetworkSwitch}
              title={props.interactionDisabledTitle}
            >
              Sign
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
});
