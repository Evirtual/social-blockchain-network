import type { AccountFeedView } from "../hooks/useAccountFeedView";

type Props = {
  view: AccountFeedView;
  onViewChange: (next: AccountFeedView) => void;
  postedCount: number;
  savedCount: number;
  likedCount: number;
};

export function AccountFeedHeaderAction(props: Props) {
  return (
    <div className="row" style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
      <button
        className={`pill pillButton ${props.view === "all" ? "isActive" : ""}`}
        type="button"
        onClick={() => props.onViewChange("all")}
      >
        Posted ({props.postedCount})
      </button>
      <button
        className={`pill pillButton ${props.view === "saved" ? "isActive" : ""}`}
        type="button"
        onClick={() => props.onViewChange("saved")}
      >
        Saved ({props.savedCount})
      </button>
      <button
        className={`pill pillButton ${props.view === "liked" ? "isActive" : ""}`}
        type="button"
        onClick={() => props.onViewChange("liked")}
      >
        Liked ({props.likedCount})
      </button>
    </div>
  );
}
