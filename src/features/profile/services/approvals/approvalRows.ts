import { normalizeAddress } from "@shared/lib/address";

export type ApprovalRowData = {
  addr: string;
  key: string;
  isFlagged: boolean;
  isAllowed: boolean;
  isModerator: boolean;
};

export function buildApprovalRows(args: {
  addresses: string[];
  posterAllowedByAddress: Record<string, boolean | undefined>;
  posterDisapprovedEverByAddress: Record<string, boolean | undefined>;
  moderatorsByAddress?: Record<string, boolean | undefined>;
  excludeAddress?: string | null;
}): ApprovalRowData[] {
  const exclude = normalizeAddress(args.excludeAddress);
  return args.addresses
    .filter((addr) => normalizeAddress(addr) !== exclude)
    .map((addr) => {
      const key = normalizeAddress(addr);
      return {
        addr,
        key,
        isFlagged: !!args.posterDisapprovedEverByAddress[key],
        isAllowed: !!args.posterAllowedByAddress[key],
        isModerator: !!args.moderatorsByAddress?.[key]
      };
    });
}
