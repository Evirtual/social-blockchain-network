import { isAddress } from "ethers";

import { getScanProviderFromReadContract } from "@shared/lib/contractRunner";
import { hasPinata } from "@features/ipfs";
import { discoverMintedTokenIdsForAuthor } from "@features/profile";
import { bestEffortUnpinCids, collectPinnedCidsForTokenIds, collectReferencedIpfsCidsFromPosts } from "@features/ipfs";
import type { Post } from "@types";
import { emitPosterAllowedChanged } from "@shared/lib/posterAllowedEvents";
import type { TransactionResponse } from "ethers";
import type { ChainProvider, ReadContractFactory, WriteContractFactory } from "@features/contract";

type RunContractTxLike = <T = void>(
  label: string,
  send: () => Promise<TransactionResponse>,
  onSuccess?: () => T
) => Promise<T | undefined>;

export function useApprovalActions(args: {
  pendingApprovals: string[];
  setPendingApprovals: (next: string[]) => void;
  setApprovalsError: (next: string | null) => void;
  setPendingInput: (next: string) => void;

  setPosterAllowedByAddress: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  setPosterDisapprovedEverByAddress: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;

  runContractTx: RunContractTxLike;
  getReadContract: ReadContractFactory;
  getWriteContract: WriteContractFactory;

  feedPosts: Post[];
}) {
  function addPendingApproval(raw: string) {
    const addr = raw.trim();
    if (!isAddress(addr)) {
      args.setApprovalsError("Invalid address");
      return;
    }
    const nextLower = addr.toLowerCase();
    const existing = args.pendingApprovals.map((a) => a.toLowerCase());
    if (existing.includes(nextLower)) {
      args.setApprovalsError("Already in list");
      return;
    }
    const next = [addr, ...args.pendingApprovals];
    args.setApprovalsError(null);
    args.setPendingApprovals(next);
    args.setPendingInput("");
  }

  function removePending(addr: string) {
    const next = args.pendingApprovals.filter((a) => a.toLowerCase() !== addr.toLowerCase());
    args.setPendingApprovals(next);
  }

  async function approvePending(addr: string) {
    args.setApprovalsError(null);
    await args.runContractTx("Approve poster", async () => {
      const writeContract = await args.getWriteContract();
      return writeContract.setPosterAllowed(addr, true);
    });

    args.setPosterAllowedByAddress((prev) => ({ ...prev, [addr.toLowerCase()]: true }));
    emitPosterAllowedChanged({ address: addr, allowed: true, disapprovedEver: false });
  }

  async function disapprovePending(addr: string) {
    args.setApprovalsError(null);
    await args.runContractTx("Disapprove poster", async () => {
      const writeContract = await args.getWriteContract();
      return writeContract.setPosterAllowed(addr, false);
    });

    args.setPosterAllowedByAddress((prev) => ({ ...prev, [addr.toLowerCase()]: false }));
    args.setPosterDisapprovedEverByAddress((prev) => ({ ...prev, [addr.toLowerCase()]: true }));
    emitPosterAllowedChanged({ address: addr, allowed: false, disapprovedEver: true });
  }

  async function resetAllAndBlock(addr: string) {
    const normalized = addr.trim();
    if (!isAddress(normalized)) {
      args.setApprovalsError("Invalid address");
      return;
    }

    args.setApprovalsError(null);

    let tokenIds: bigint[] = [];
    let tokenDiscoveryFailed = false;
    try {
      const readContract = await args.getReadContract();
      const provider: ChainProvider | null = getScanProviderFromReadContract(readContract);
      const discovery = discoverMintedTokenIdsForAuthor({
        readContract,
        scanProvider: provider,
        author: normalized
      });
      const discovered = await Promise.race([
        discovery,
        new Promise<{ tokenIds: bigint[]; failed: boolean }>((resolve) =>
          setTimeout(() => resolve({ tokenIds: [], failed: true }), 5000)
        )
      ]);
      tokenIds = discovered.tokenIds;
      tokenDiscoveryFailed = discovered.failed;
    } catch {
      tokenDiscoveryFailed = true;
      tokenIds = [];
    }

    let pinnedCids: Set<string> | null = null;

    try {
      await args.runContractTx("Reset account", async () => {
        try {
          if (hasPinata() && tokenIds.length) {
            const readContract = await args.getReadContract();
            pinnedCids = await collectPinnedCidsForTokenIds({ readContract, tokenIds, concurrency: 4 });
          }
        } catch {
          pinnedCids = null;
        }

        const writeContract = await args.getWriteContract();
        return writeContract.adminResetAccount(normalized, tokenIds);
      });
    } catch {
      return;
    }

    try {
      if (pinnedCids) {
        const referenced = collectReferencedIpfsCidsFromPosts(args.feedPosts);
        void bestEffortUnpinCids(pinnedCids, { protectReferencedIn: referenced });
      }
    } catch {
      // ignore
    }

    args.setPosterAllowedByAddress((prev) => ({ ...prev, [normalized.toLowerCase()]: false }));
    args.setPosterDisapprovedEverByAddress((prev) => ({ ...prev, [normalized.toLowerCase()]: true }));
    emitPosterAllowedChanged({ address: normalized, allowed: false, disapprovedEver: true });

    if (tokenDiscoveryFailed) {
      args.setApprovalsError("Blocked user, but failed to load their posts for deletion.");
    }
  }

  return {
    addPendingApproval,
    removePending,
    approvePending,
    disapprovePending,
    resetAllAndBlock
  };
}
