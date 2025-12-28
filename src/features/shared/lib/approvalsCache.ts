// NOTE: Intentionally no sessionStorage persistence.
// These helpers exist for compatibility but are non-persistent to avoid cross-network stale data.

export function readApprovalsChainRequestsCache(contractAddress: string | undefined): {
  requesters: string[];
  updatedAt: number;
} | null {
  void contractAddress;
  return null;
}

export function writeApprovalsChainRequestsCache(contractAddress: string | undefined, requesters: string[]) {
  void contractAddress;
  void requesters;
}

export function readPendingApprovals(): string[] {
  return [];
}

export function writePendingApprovals(next: string[]) {
  void next;
}
