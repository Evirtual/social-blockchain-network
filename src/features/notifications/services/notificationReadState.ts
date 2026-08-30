import { readLocalCache, writeLocalCache } from "@shared/lib/localCache";
import type { NotificationItem } from "../types";

const EVENT_NAME = "sbn:notificationsSeen";

function norm(s: string | null | undefined): string {
  return String(s ?? "").trim().toLowerCase();
}

export function notificationsLastSeenKey(chainId: string | null, walletAddress: string | null): string {
  const c = norm(chainId);
  const w = norm(walletAddress);
  return `socialBlockchainNetwork.notifications.lastSeen.${c || "unknown"}.${w || "unknown"}`;
}

export function readNotificationsLastSeen(chainId: string | null, walletAddress: string | null): number {
  const key = notificationsLastSeenKey(chainId, walletAddress);
  const cached = readLocalCache<{ ts?: number }>(key);
  const ts = typeof cached?.ts === "number" ? cached.ts : 0;
  return Number.isFinite(ts) ? ts : 0;
}

export function writeNotificationsLastSeen(chainId: string | null, walletAddress: string | null, ts: number): void {
  const key = notificationsLastSeenKey(chainId, walletAddress);
  writeLocalCache(key, { ts });
  try {
    window.dispatchEvent(new Event(EVENT_NAME));
  } catch {
    // ignore
  }
}

export function onNotificationsLastSeenChanged(handler: () => void): () => void {
  const h = () => handler();
  window.addEventListener(EVENT_NAME, h);
  return () => window.removeEventListener(EVENT_NAME, h);
}

export function maxNotificationTimestamp(items: NotificationItem[]): number {
  let max = 0;
  for (const n of items) {
    const t = typeof n?.timestamp === "number" ? n.timestamp : 0;
    if (t > max) max = t;
  }
  return max;
}

export function countUnreadNotifications(items: NotificationItem[], lastSeenTs: number): number {
  let c = 0;
  for (const n of items) {
    const t = typeof n?.timestamp === "number" ? n.timestamp : 0;
    if (t > lastSeenTs) c += 1;
  }
  return c;
}
