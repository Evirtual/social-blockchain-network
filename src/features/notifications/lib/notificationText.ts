import type { NotificationItem } from "../types";

export function notificationActionText(kind: string): string {
  switch (kind) {
    case "POST_LIKED":
      return "liked your post";
    case "POST_SAVED":
      return "saved your post";
    case "POST_COMMENTED":
      return "commented on your post";
    case "POST_TIPPED":
      return "tipped your post";
    case "COMMENT_LIKED":
      return "liked your comment";
    case "COMMENT_SAVED":
      return "saved your comment";
    case "COMMENT_REPLIED":
      return "replied to your comment";
    case "COMMENT_TIPPED":
      return "tipped your comment";
    case "POSTER_APPROVAL_REQUESTED":
      return "requested posting approval";
    case "POSTER_APPROVED":
      return "was approved to post";
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

  const base = `Post #${n.tokenId}`;
  const cid = typeof n.commentId === "string" && n.commentId.trim() ? n.commentId.trim() : "";
  if (!cid) return base;

  if (n.kind === "COMMENT_REPLIED") return `${base} | Reply to comment #${cid}`;
  if (n.kind === "COMMENT_LIKED" || n.kind === "COMMENT_SAVED") return `${base} | Comment #${cid}`;
  if (n.kind === "POST_COMMENTED") return `${base} | Comment #${cid}`;
  if (n.kind === "COMMENT_TIPPED") return `${base} | Comment #${cid}`;
  if (n.kind === "COMMENT_REMOVED") return `${base} | Comment #${cid} removed`;
  return base;
}
