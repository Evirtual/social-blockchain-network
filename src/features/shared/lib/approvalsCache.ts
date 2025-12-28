const PENDING_APPROVALS_KEY = "pendingPosterApprovals";
const APPROVALS_CHAIN_CACHE_PREFIX = "approvalsChainRequestsCache:";

function approvalsChainCacheKey(contractAddress: string | undefined): string | null {
  if (!contractAddress) return null;
  const key = contractAddress.trim().toLowerCase();
  if (!key) return null;
  return `${APPROVALS_CHAIN_CACHE_PREFIX}${key}`;
}

export function readApprovalsChainRequestsCache(contractAddress: string | undefined): {
  requesters: string[];
  updatedAt: number;
} | null {
  if (typeof window === "undefined") return null;
  const key = approvalsChainCacheKey(contractAddress);
  if (!key) return null;

  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as any;
    const requesters = Array.isArray(parsed?.requesters)
      ? parsed.requesters.filter((x: unknown) => typeof x === "string" && x.trim()).map((x: string) => x.trim())
      : [];
    const updatedAt = Number(parsed?.updatedAt);
    if (!Number.isFinite(updatedAt) || updatedAt <= 0) return null;
    return { requesters, updatedAt };
  } catch {
    return null;
  }
}

export function writeApprovalsChainRequestsCache(contractAddress: string | undefined, requesters: string[]) {
  if (typeof window === "undefined") return;
  const key = approvalsChainCacheKey(contractAddress);
  if (!key) return;

  window.sessionStorage.setItem(
    key,
    JSON.stringify({ requesters: requesters.filter((x) => typeof x === "string" && x.trim()), updatedAt: Date.now() })
  );
}

export function readPendingApprovals(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(PENDING_APPROVALS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x) => typeof x === "string" && x.trim()).map((x) => x.trim());
  } catch {
    return [];
  }
}

export function writePendingApprovals(next: string[]) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(PENDING_APPROVALS_KEY, JSON.stringify(next));
}
