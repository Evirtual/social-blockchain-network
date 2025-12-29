import type { AccountFeedView } from "../hooks/useAccountFeedView";
import { IconBookmark, IconEdit, IconHeart } from "../../app";

type Props = {
  view: AccountFeedView;
  onViewChange: (next: AccountFeedView) => void;
  postedCount: number;
  savedCount: number;
  likedCount: number;
};

export function AccountFeedHeaderAction(props: Props) {
  return (
    <div className="accountFeedHeaderTabs">
      <button
        className={`accountFeedTabButton isPosted ${props.view === "all" ? "isActive" : ""}`}
        type="button"
        onClick={() => props.onViewChange("all")}
        aria-label={`Posted (${props.postedCount})`}
        title={`Posted (${props.postedCount})`}
      >
        <IconEdit size={20} />
        <span className="accountFeedTabCount">{props.postedCount}</span>
      </button>
      <button
        className={`accountFeedTabButton isSaved ${props.view === "saved" ? "isActive" : ""}`}
        type="button"
        onClick={() => props.onViewChange("saved")}
        aria-label={`Saved (${props.savedCount})`}
        title={`Saved (${props.savedCount})`}
      >
        <IconBookmark size={20} filled={props.view === "saved"} />
        <span className="accountFeedTabCount">{props.savedCount}</span>
      </button>
      <button
        className={`accountFeedTabButton isLiked ${props.view === "liked" ? "isActive" : ""}`}
        type="button"
        onClick={() => props.onViewChange("liked")}
        aria-label={`Liked (${props.likedCount})`}
        title={`Liked (${props.likedCount})`}
      >
        <IconHeart size={20} filled={props.view === "liked"} />
        <span className="accountFeedTabCount">{props.likedCount}</span>
      </button>
    </div>
  );
}
