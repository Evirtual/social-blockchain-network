import { parseChainKey } from "@shared/lib/chainKey";

export type SessionTokenKeyPrefix = "likesTokenKeysByAddress:" | "savedTokenKeysByAddress:";

export function buildTokenKey(args: {
  tokenId: string;
  postChainId?: string | null;
  currentChainId: string | null;
}) {
  const chainKey = parseChainKey(args.postChainId ?? args.currentChainId);
  return chainKey ? `${chainKey}:${args.tokenId}` : args.tokenId;
}

export function updateSessionTokenKeys(args: {
  prefix: SessionTokenKeyPrefix;
  addressLower: string;
  tokenKey: string;
  add: boolean;
}) {
  void args;
}
