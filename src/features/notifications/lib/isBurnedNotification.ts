import { isPostBurned } from "@shared/lib/burnedPostsCache";
import type { NotificationItem } from "../types";

export function isBurnedNotification(item: NotificationItem, fallbackChainId: string | null): boolean {
  const tokenId = String(item?.tokenId ?? "").trim();
  if (!tokenId || tokenId === "0") return false;

  // Admin removals are handled separately (still shown, but non-navigable).
  if (item.kind === "POST_REMOVED_BY_ADMIN") return false;

  const chainId = typeof item.chainId === "string" && item.chainId.trim() ? item.chainId.trim() : fallbackChainId;
  return isPostBurned(chainId ?? null, tokenId);
}
