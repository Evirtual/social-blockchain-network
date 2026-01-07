import type { NotificationItem } from "../types";

export function notificationActionText(kind: string): string {
  switch (kind) {
    case "POST_LIKED":
      return "liked your post";
    case "POST_SAVED":
      return "saved your post";
    case "POST_COMMENTED":
      return "commented on your post";
    case "COMMENT_LIKED":
      return "liked your comment";
    case "COMMENT_SAVED":
      return "saved your comment";
    case "COMMENT_REPLIED":
      return "replied to your comment";
    default:
      return "interacted with you";
  }
}

export function notificationDetailText(n: NotificationItem): string {
  const base = `Post #${n.tokenId}`;
  const cid = typeof n.commentId === "string" && n.commentId.trim() ? n.commentId.trim() : "";
  if (!cid) return base;

  if (n.kind === "COMMENT_REPLIED") return `${base} | Reply to comment #${cid}`;
  if (n.kind === "COMMENT_LIKED" || n.kind === "COMMENT_SAVED") return `${base} | Comment #${cid}`;
  if (n.kind === "POST_COMMENTED") return `${base} | Comment #${cid}`;
  return base;
}
