import type { NotificationItem } from "../types";

export function notificationActionText(kind: string): string {
  switch (kind) {
    case "FOLLOWED":
      return "followed you";
    case "UNFOLLOWED":
      return "unfollowed you";
    case "POST_LIKED":
      return "liked your post";
    case "POST_UNLIKED":
      return "unliked your post";
    case "POST_SAVED":
      return "saved your post";
    case "POST_UNSAVED":
      return "unsaved your post";
    case "POST_COMMENTED":
      return "commented on your post";
    case "POST_TIPPED":
      return "tipped your post";
    case "POST_UPDATED_BY_ADMIN":
      return "updated your post";
    case "POST_FROZEN":
      return "froze your post";
    case "POST_REPORTED":
      return "reported a post";
    case "COMMENT_LIKED":
      return "liked your comment";
    case "COMMENT_UNLIKED":
      return "unliked your comment";
    case "COMMENT_SAVED":
      return "saved your comment";
    case "COMMENT_UNSAVED":
      return "unsaved your comment";
    case "COMMENT_REPLIED":
      return "replied to your comment";
    case "COMMENT_TIPPED":
      return "tipped your comment";
    case "COMMENT_REPORTED":
      return "reported a comment";
    case "POSTER_APPROVAL_REQUESTED":
      return "requested posting approval";
    case "POSTER_APPROVED":
      return "was approved to post";
    case "POSTER_DISAPPROVED":
      return "was disapproved to post";
    case "PROFILE_MODERATED":
      return "moderated your profile";
    case "PROFILE_CLEARED_BY_ADMIN":
      return "cleared your profile";
    case "POST_REMOVED_BY_ADMIN":
      return "removed your post";
    case "COMMENT_REMOVED":
      return "removed your comment";
    default:
      return "interacted with you";
  }
}

export function notificationDetailText(n: NotificationItem): string {
  if (n.kind === "POSTER_APPROVAL_REQUESTED") return "Posting approval requested";
  if (n.kind === "POSTER_APPROVED") return "Posting approved";
  if (n.kind === "POSTER_DISAPPROVED") return "Posting disapproved";
  if (n.kind === "PROFILE_MODERATED") return "Profile moderated";
  if (n.kind === "PROFILE_CLEARED_BY_ADMIN") return "Profile cleared";
  if (n.kind === "FOLLOWED") return "New follower";

  if (n.tokenId === "0") return "";
  if (n.kind === "COMMENT_REPLIED") return "Reply to your comment";
  if (n.kind === "COMMENT_REMOVED") return "Comment removed";
  if (n.kind === "COMMENT_REPORTED") return "Comment reported";
  if (n.kind === "POST_REPORTED") return "Post reported";
  return "";
}
