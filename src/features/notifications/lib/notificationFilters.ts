import type { NotificationItem } from "../types";

const HIDDEN_FOR_NON_ADMIN = new Set([
  "UNFOLLOWED",
  "POST_UNLIKED",
  "POST_UNSAVED",
  "COMMENT_UNLIKED",
  "COMMENT_UNSAVED"
]);

export function filterNotificationsForViewer(items: NotificationItem[], isOwner: boolean): NotificationItem[] {
  if (isOwner) return items;
  return items.filter((n) => !HIDDEN_FOR_NON_ADMIN.has(n.kind));
}
