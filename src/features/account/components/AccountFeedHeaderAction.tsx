import type { AccountFeedView } from "../hooks/useAccountFeedView";
import { IconBookmark, IconEdit, IconHeart } from "@shared/components/icons";

type Props = {
  view: AccountFeedView;
  onViewChange: (next: AccountFeedView) => void;
  postedCount: number;
  savedCount: number;
  likedCount: number;
  isPostedLoading?: boolean;
  isSavedLoading?: boolean;
  isLikedLoading?: boolean;
};

export function AccountFeedHeaderAction(props: Props) {
  const countNode = (value: number, isLoading?: boolean) =>
    isLoading ? <span className="skeletonLine" style={{ width: "1.5rem", height: "0.85rem" }} /> : value;

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
        <span className="accountFeedTabCount">{countNode(props.postedCount, props.isPostedLoading)}</span>
      </button>
      <button
        className={`accountFeedTabButton isSaved ${props.view === "saved" ? "isActive" : ""}`}
        type="button"
        onClick={() => props.onViewChange("saved")}
        aria-label={`Saved (${props.savedCount})`}
        title={`Saved (${props.savedCount})`}
      >
        <IconBookmark size={20} filled={props.view === "saved"} />
        <span className="accountFeedTabCount">{countNode(props.savedCount, props.isSavedLoading)}</span>
      </button>
      <button
        className={`accountFeedTabButton isLiked ${props.view === "liked" ? "isActive" : ""}`}
        type="button"
        onClick={() => props.onViewChange("liked")}
        aria-label={`Liked (${props.likedCount})`}
        title={`Liked (${props.likedCount})`}
      >
        <IconHeart size={20} filled={props.view === "liked"} />
        <span className="accountFeedTabCount">{countNode(props.likedCount, props.isLikedLoading)}</span>
      </button>
    </div>
  );
}
