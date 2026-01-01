import { useCallback } from "react";
import { isAddress } from "ethers";

import { hasPinata, pinataPinFile } from "@features/ipfs";
import { getScanProviderFromReadContract } from "@shared/lib/contractRunner";
import { discoverMintedTokenIdsForAuthor } from "../services/mintedTokenDiscovery";
import { bestEffortUnpinCids, collectReferencedIpfsCidsFromPosts, collectPinnedCidsForTokenIds } from "@features/ipfs";
import { emitPosterAllowedChanged } from "@shared/lib/posterAllowedEvents";

export function useProfileAdminActions(args: {
  address: string;
  contract: {
    isOwner: boolean;
    getReadContract: () => Promise<any>;
    getWriteContract: () => Promise<any>;
  };
  runContractTx: (label: string, fn: () => Promise<any>) => Promise<any>;

  feedPosts: any[];
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
        return (writeContract as any).setPosterAllowed(args.address, allowed);
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
    {
      const readContract = await args.contract.getReadContract();
      const provider: any = getScanProviderFromReadContract(readContract);
      const discovered = await discoverMintedTokenIdsForAuthor({
        readContract,
        scanProvider: provider,
        author: normalized
      });
      tokenIds = discovered.tokenIds;
    }

    let pinnedCids: unknown = null;

    try {
      await args.runContractTx("Reset account", async () => {
        // Best-effort: collect pinned CIDs before burn so we can unpin after.
        try {
          if (hasPinata() && tokenIds.length) {
            const readContract = await args.contract.getReadContract();
            pinnedCids = await collectPinnedCidsForTokenIds({ readContract, tokenIds, concurrency: 4 });
          }
        } catch {
          pinnedCids = null;
        }

        const writeContract = await args.contract.getWriteContract();
        return (writeContract as any).adminResetAccount(normalized, tokenIds);
      });
    } catch {
      return;
    }

    try {
      const maybePinned = pinnedCids as any;
      if (maybePinned && typeof maybePinned.size === "number" && maybePinned.size > 0) {
        const excludeTokenIds = tokenIds.map((x) => x.toString());
        const referenced = collectReferencedIpfsCidsFromPosts(args.feedPosts, {
          exclude: { chainId: args.walletChainId, tokenIds: excludeTokenIds }
        });
        void bestEffortUnpinCids(maybePinned as Set<string>, { protectReferencedIn: referenced });
      }
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

      const name = next.name.trim();
      const bio = next.bio.trim();
      let avatar = next.avatarUrl.trim();

      if (next.avatarFile) {
        if (hasPinata()) {
          const pinned = await pinataPinFile(next.avatarFile, next.avatarFilename || "avatar.png");
          avatar = `ipfs://${pinned.IpfsHash}`;
        } else {
          avatar = next.avatarDataUrl || "";
        }
      }

      await args.runContractTx("Admin set profile", async () => {
        const writeContract = await args.contract.getWriteContract();
        return (writeContract as any).adminSetProfile(args.address, name, bio, avatar);
      });

      await args.loadProfile(args.address);
    },
    [args]
  );

  return { onAdminSetPosterAllowed, onAdminReset, onAdminSetProfile };
}
