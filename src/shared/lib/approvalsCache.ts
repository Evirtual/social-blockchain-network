// NOTE: Intentionally non-persistent (in-memory only).
// This avoids cross-network stale data while still preventing repeated reads
// during in-app navigation (which can trigger RPC rate limits).

type ApprovalsChainRequestsCacheValue = {
  requesters: string[];
  updatedAt: number;
};

const approvalsChainRequestsCache = new Map<string, ApprovalsChainRequestsCacheValue>();

export function readApprovalsChainRequestsCache(cacheKey: string | undefined): ApprovalsChainRequestsCacheValue | null {
  const key = String(cacheKey ?? "").trim();
  if (!key) return null;
  return approvalsChainRequestsCache.get(key) ?? null;
}

export function writeApprovalsChainRequestsCache(cacheKey: string | undefined, requesters: string[]) {
  const key = String(cacheKey ?? "").trim();
  if (!key) return;
  approvalsChainRequestsCache.set(key, { requesters, updatedAt: Date.now() });
}

