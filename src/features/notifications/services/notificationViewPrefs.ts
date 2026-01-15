import { readLocalCache, writeLocalCache } from "@shared/lib/localCache";

const KEY = "socialBlockchainNetwork.notifications.showBurned";

type CacheShape = {
  v?: 0 | 1;
};

export function readShowBurnedNotifications(): boolean {
  const cached = readLocalCache<CacheShape>(KEY);
  return cached?.v === 1;
}

export function writeShowBurnedNotifications(next: boolean): void {
  writeLocalCache(KEY, { v: next ? 1 : 0 });
}
