import { IconBookmark, IconCoin, IconHeart, IconMessage } from "@shared/components/icons";
import { formatTipsWei } from "./formatTips";
import { getStatButtonClass } from "./getStatButtonClass";
import type { PostPanel } from "../postPanel";
import type { Post } from "@types";

type Props = {
  post: Readonly<Post>;
  requiresNetworkSwitch: boolean;
  interactionDisabledTitle?: string;
  interactionsDisabled?: boolean;
  nativeSymbol: string;
  openPanel: PostPanel | null;
  isBusy: boolean;
  inFlight: string | null;
  canOpenComments: boolean;
  onLike: () => void;
  onSave: () => void;
  onToggleComment: () => void;
  onToggleTip: () => void;
};

export function PostStatsButtons(props: Props) {
  return (
    <div className="postStats">
      <button
        className={getStatButtonClass({
          requiresNetworkSwitch: props.requiresNetworkSwitch,
          active: props.post.likedByMe ? "isActive isLike" : ""
        })}
        type="button"
        onClick={props.onLike}
        aria-label="Like"
        aria-busy={props.inFlight === "like"}
        aria-disabled={!!props.interactionsDisabled}
        disabled={props.requiresNetworkSwitch || props.isBusy}
        title={props.interactionDisabledTitle}
      >
        {props.inFlight === "like" ? (
          <span className="spinner" aria-hidden="true" />
        ) : (
          <IconHeart size={20} filled={!!props.post.likedByMe} />
        )}
        <span className="postActionCount">{props.post.likes}</span>
      </button>

      <button
        className={getStatButtonClass({
          requiresNetworkSwitch: props.requiresNetworkSwitch,
          active: props.post.savedByMe ? "isActive isSaved" : ""
        })}
        type="button"
        onClick={props.onSave}
        aria-label="Save"
        aria-busy={props.inFlight === "save"}
        aria-disabled={!!props.interactionsDisabled}
        disabled={props.requiresNetworkSwitch || props.isBusy}
        title={props.interactionDisabledTitle}
      >
        {props.inFlight === "save" ? (
          <span className="spinner" aria-hidden="true" />
        ) : (
          <IconBookmark size={20} filled={!!props.post.savedByMe} />
        )}
        <span className="postActionCount">{props.post.saves}</span>
      </button>

      <button
        className={getStatButtonClass({ requiresNetworkSwitch: false })}
        type="button"
        onClick={props.onToggleComment}
        aria-label="Comment"
        aria-expanded={props.openPanel === "comment"}
        disabled={props.isBusy || !props.canOpenComments}
        title={props.interactionDisabledTitle}
      >
        <IconMessage size={20} />
        <span className="postActionCount">{props.post.comments}</span>
      </button>

      <button
        className={getStatButtonClass({
          requiresNetworkSwitch: props.requiresNetworkSwitch
        })}
        type="button"
        onClick={props.onToggleTip}
        aria-label="Tip"
        aria-expanded={props.openPanel === "tip"}
        aria-disabled={!!props.interactionsDisabled}
        disabled={props.requiresNetworkSwitch || props.isBusy}
        title={props.interactionDisabledTitle}
      >
        <IconCoin size={20} />
        <span className="postActionCount">{formatTipsWei({ tipsWei: props.post.tipsWei, nativeSymbol: props.nativeSymbol })}</span>
      </button>
    </div>
  );
}
