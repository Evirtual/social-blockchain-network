import { useCallback } from "react";
import { isAddress } from "ethers";
import type { Post } from "@types";

import { extractIpfsCid, hasPinata, makePinataBaseName, makeUniqueFilename, makeUniquePinName, pinataPinFile } from "@features/ipfs";
import { getScanProviderFromReadContract } from "@shared/lib/contractRunner";
import { discoverMintedTokenIdsForAuthor } from "../services/mintedTokenDiscovery";
import { bestEffortUnpinCids, collectReferencedIpfsCidsFromPosts, collectPinnedCidsForTokenIds } from "@features/ipfs";
import { emitPosterAllowedChanged } from "@shared/lib/posterAllowedEvents";
import type { TransactionResponse } from "ethers";
import type { ChainProvider, ReadContractFactory, WriteContractFactory } from "@features/contract";

export function useProfileAdminActions(args: {
  address: string;
  contract: {
    isOwner: boolean;
    getReadContract: ReadContractFactory;
    getWriteContract: WriteContractFactory;
  };
  runContractTx: <T = void>(
    label: string,
    fn: () => Promise<TransactionResponse>,
    onSuccess?: () => T
  ) => Promise<T | undefined>;

  feedPosts: Post[];
  refreshFeed: () => Promise<void>;
  walletChainId: string | null;
  loadProfile: (address: string) => Promise<void>;

  setIsPosterAllowed: (next: boolean) => void;
  setWasPosterDisapprovedEver: (next: boolean) => void;
}) {
  const onAdminSetPosterAllowed = useCallback(
    async (allowed: boolean) => {
      if (!args.contract.isOwner) return;
      if (!isAddress(args.address)) return;

      await args.runContractTx(allowed ? "Approve poster" : "Disapprove poster", async () => {
        const writeContract = await args.contract.getWriteContract();
        return writeContract.setPosterAllowed(args.address, allowed);
      });

      args.setIsPosterAllowed(allowed);
      if (!allowed) args.setWasPosterDisapprovedEver(true);
      emitPosterAllowedChanged({ address: args.address, allowed, disapprovedEver: !allowed });
    },
    [args]
  );

  const onAdminReset = useCallback(async () => {
    if (!args.contract.isOwner) return;
    const normalized = args.address.trim();
    if (!isAddress(normalized)) return;

    const fallbackTokenIdsFromFeed = () => {
      const out: string[] = [];
      const normalizedKey = normalized.toLowerCase();
      const chainKey = String(args.walletChainId ?? "").trim();
      for (const p of args.feedPosts) {
        if (!p?.tokenId) continue;
        if (String(p.author ?? "").toLowerCase() !== normalizedKey) continue;

        // If the post's chainId is missing (older cached entries), treat it as matching the active chain.
        const pChain = String(p.chainId ?? "").trim();
        if (chainKey && pChain && pChain !== chainKey) continue;
        out.push(String(p.tokenId));
      }
      return Array.from(new Set(out));
    };

    const tryGetTokenIdsOnChain = async (): Promise<bigint[] | null> => {
      try {
        const readContract = await args.contract.getReadContract();
        const c = readContract as any;
        if (typeof c.authorTokenIdsCount !== "function") return null;

        const count = (await c.authorTokenIdsCount(normalized)) as bigint;
        if (typeof count !== "bigint") return null;
        if (count === 0n) return [];

        const pageSize = 50n;

        const out: bigint[] = [];
        if (typeof c.authorTokenIdsSlice === "function") {
          for (let start = 0n; start < count; start += pageSize) {
            const page = (await c.authorTokenIdsSlice(normalized, start, pageSize)) as bigint[];
            if (!Array.isArray(page)) return null;
            for (const id of page) {
              if (typeof id !== "bigint") return null;
              out.push(id);
            }
          }
          return out;
        }

        if (typeof c.authorTokenIdAt === "function") {
          for (let i = 0n; i < count; i++) {
            const id = (await c.authorTokenIdAt(normalized, i)) as bigint;
            if (typeof id !== "bigint") return null;
            out.push(id);
          }
          return out;
        }

        return null;
      } catch {
        return null;
      }
    };

    let tokenIds: bigint[] = [];
    const onChain = await tryGetTokenIdsOnChain();
    if (onChain !== null) {
      tokenIds = onChain;
    } else {
      try {
        const readContract = await args.contract.getReadContract();
        const provider: ChainProvider | null = getScanProviderFromReadContract(readContract);
        const discovered = await discoverMintedTokenIdsForAuthor({
          readContract,
          scanProvider: provider,
          author: normalized
        });
        tokenIds = discovered.tokenIds;
      } catch {
        tokenIds = [];
      }
    }

    // NOTE: CID collection can be slow (tokenURI reads + IPFS gateway fetches).
    // Start it concurrently so the wallet transaction prompt isn't blocked.
    const collectPinnedCidsAsync = async (): Promise<Set<string> | null> => {
      if (!hasPinata()) return null;

      const out = new Set<string>();
      const normalizedKey = normalized.toLowerCase();
      const chainKey = String(args.walletChainId ?? "").trim();

      // Best-effort: also collect from already-loaded feed.
      for (const p of args.feedPosts) {
        if (String(p.author ?? "").toLowerCase() !== normalizedKey) continue;
        const pChain = String(p.chainId ?? "").trim();
        if (chainKey && pChain && pChain !== chainKey) continue;

        const refs = [p.metadataURI, p.image, p.animationUrl].filter(
          (x): x is string => typeof x === "string" && x.trim().length > 0
        );
        for (const ref of refs) {
          const cid = extractIpfsCid(ref);
          if (cid) out.add(cid);
        }
      }

      try {
        const readContract = await args.contract.getReadContract();

        if (tokenIds.length) {
          const cids = await collectPinnedCidsForTokenIds({ readContract, tokenIds, concurrency: 4 });
          for (const cid of cids) out.add(cid);
        }

        // Also collect current avatar pin so reset clears it too.
        try {
          const profile = (await (readContract as any).profileOf(normalized)) as unknown;
          const prevAvatarUrl = String((profile as any)?.[2] ?? (profile as any)?.avatar ?? "");
          const avatarCid = extractIpfsCid(prevAvatarUrl);
          if (avatarCid) out.add(avatarCid);
        } catch {
          // ignore
        }
      } catch {
        // ignore
      }

      return out.size ? out : null;
    };

    const pinnedCidsPromise = collectPinnedCidsAsync();

    try {
      await args.runContractTx("Reset account", async () => {
        const writeContract = await args.contract.getWriteContract();
        return writeContract.adminResetAccount(normalized, tokenIds);
      });
    } catch {
      return;
    }

    try {
      const excludeTokenIds = tokenIds.length ? tokenIds.map((x) => x.toString()) : fallbackTokenIdsFromFeed();
      const referenced = collectReferencedIpfsCidsFromPosts(args.feedPosts, {
        exclude: { chainId: args.walletChainId, tokenIds: excludeTokenIds }
      });

      // Unpin in the background when CID collection completes.
      void pinnedCidsPromise
        .then((cids) => {
          if (!cids || cids.size === 0) return;
          return bestEffortUnpinCids(cids, { protectReferencedIn: referenced });
        })
        .catch(() => {
          // ignore
        });
    } catch {
      // ignore
    }

    args.setIsPosterAllowed(false);
    args.setWasPosterDisapprovedEver(true);
    emitPosterAllowedChanged({ address: normalized, allowed: false, disapprovedEver: true });

    try {
      await args.loadProfile(normalized);
    } catch {
      // ignore
    }

    try {
      await args.refreshFeed();
    } catch {
      // ignore
    }
  }, [args]);

  const onAdminSetProfile = useCallback(
    async (next: {
      name: string;
      bio: string;
      avatarUrl: string;
      avatarFile?: File | null;
      avatarFilename?: string;
      avatarDataUrl?: string;
    }) => {
      if (!args.contract.isOwner) return;
      if (!isAddress(args.address)) return;

      let txSucceeded = false;
      let prevAvatarCid: string | null = null;
      let newAvatarCid: string | null = null;

      const name = next.name.trim();
      const bio = next.bio.trim();
      let avatar = next.avatarUrl.trim();

      try {
        const readContract = await args.contract.getReadContract();
        const profile = (await readContract.profileOf(args.address)) as unknown;
        const prevAvatarUrl = String((profile as any)?.[2] ?? (profile as any)?.avatar ?? "");
        prevAvatarCid = extractIpfsCid(prevAvatarUrl);
      } catch {
        prevAvatarCid = null;
      }

      if (next.avatarFile) {
        if (hasPinata()) {
          const base = makePinataBaseName({ kind: "profile", purpose: "avatar", account: args.address });
          const uniqueName = makeUniquePinName(base);
          const uniqueFilename = makeUniqueFilename(base, next.avatarFile.type);
          const pinned = await pinataPinFile(next.avatarFile, uniqueFilename, uniqueName, { wrapWithDirectory: true });
          avatar = `ipfs://${pinned.IpfsHash}/${uniqueFilename}`;
          newAvatarCid = extractIpfsCid(avatar);
        } else {
          avatar = next.avatarDataUrl || "";
        }
      }

      try {
        await args.runContractTx("Admin set profile", async () => {
          const writeContract = await args.contract.getWriteContract();
          return writeContract.adminSetProfile(args.address, name, bio, avatar);
        });
        txSucceeded = true;
      } finally {
        // If we pinned a new avatar but the tx failed, unpin it to avoid leaking unused pins.
        if (!txSucceeded && hasPinata() && newAvatarCid && (!prevAvatarCid || newAvatarCid !== prevAvatarCid)) {
          const protect = new Set<string>();
          if (prevAvatarCid) protect.add(prevAvatarCid);
          void bestEffortUnpinCids([newAvatarCid], { protectReferencedIn: protect });
        }
      }

      // If the tx succeeded and the avatar changed, unpin the old CID.
      if (txSucceeded && hasPinata() && prevAvatarCid) {
        const nextCid = extractIpfsCid(avatar);
        if (!nextCid || nextCid !== prevAvatarCid) {
          const protect = new Set<string>();
          if (nextCid) protect.add(nextCid);
          void bestEffortUnpinCids([prevAvatarCid], { protectReferencedIn: protect });
        }
      }

      await args.loadProfile(args.address);
    },
    [args]
  );

  return { onAdminSetPosterAllowed, onAdminReset, onAdminSetProfile };
}
