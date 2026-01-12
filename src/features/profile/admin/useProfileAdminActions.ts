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

    let tokenIds: bigint[] = [];
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

    let pinnedCids: Set<string> | null = null;

    try {
      await args.runContractTx("Reset account", async () => {
        // Best-effort: collect pinned CIDs before burn so we can unpin after.
        try {
          if (hasPinata()) {
            const readContract = await args.contract.getReadContract();

            // Collect post-related pins.
            if (tokenIds.length) {
              pinnedCids = await collectPinnedCidsForTokenIds({ readContract, tokenIds, concurrency: 4 });
            }

            // Also collect current avatar pin so reset clears it too.
            try {
              const profile = (await (readContract as any).profileOf(normalized)) as unknown;
              const prevAvatarUrl = String((profile as any)?.[2] ?? (profile as any)?.avatar ?? "");
              const avatarCid = extractIpfsCid(prevAvatarUrl);
              if (avatarCid) {
                if (!pinnedCids) pinnedCids = new Set<string>();
                pinnedCids.add(avatarCid);
              }
            } catch {
              // ignore
            }
          }
        } catch {
          pinnedCids = null;
        }

        const writeContract = await args.contract.getWriteContract();
        return writeContract.adminResetAccount(normalized, tokenIds);
      });
    } catch {
      return;
    }

    try {
      const unpinIfNeeded = (cids: Set<string> | null) => {
        if (!cids || cids.size === 0) return;
        const excludeTokenIds = tokenIds.map((x) => x.toString());
        const referenced = collectReferencedIpfsCidsFromPosts(args.feedPosts, {
          exclude: { chainId: args.walletChainId, tokenIds: excludeTokenIds }
        });
        void bestEffortUnpinCids(cids, { protectReferencedIn: referenced });
      };
      unpinIfNeeded(pinnedCids);
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
