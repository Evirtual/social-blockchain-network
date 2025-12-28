import { parseChainKey } from "@shared/lib/chainKey";
import { readSessionTokenIds, writeSessionTokenIds } from "@shared/lib/sessionTokenCache";

export function buildTokenKey(args: {
  tokenId: string;
  postChainId?: string | null;
  currentChainId: string | null;
}) {
  const chainKey = parseChainKey(args.postChainId ?? args.currentChainId);
  return chainKey ? `${chainKey}:${args.tokenId}` : args.tokenId;
}

export function updateSessionTokenKeys(args: {
  prefix: "likesTokenKeysByAddress:" | "savedTokenKeysByAddress:";
  addressLower: string;
  tokenKey: string;
  add: boolean;
}) {
  const prev = readSessionTokenIds(args.prefix, args.addressLower) ?? [];
  const next = args.add
    ? prev.includes(args.tokenKey)
      ? prev
      : [args.tokenKey, ...prev]
    : prev.filter((k) => k !== args.tokenKey);
  writeSessionTokenIds(args.prefix, args.addressLower, next);
}
