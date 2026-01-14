import { isAddress } from "ethers";

import { getScanProviderFromReadContract } from "@shared/lib/contractRunner";
import { hasPinata } from "@features/ipfs";
import { discoverMintedTokenIdsForAuthor } from "@features/profile";
import {
  bestEffortUnpinCids,
  collectPinnedCidsForTokenIds,
  collectReferencedIpfsCidsFromPosts,
  extractIpfsCid
} from "@features/ipfs";
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
  moderatorsByAddress: Record<string, boolean>;
  setModeratorsByAddress: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;

  runContractTx: RunContractTxLike;
  getReadContract: ReadContractFactory;
  getWriteContract: WriteContractFactory;

  feedPosts: Post[];
  walletChainId: string | null;
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

    const tryGetTokenIdsOnChain = async (): Promise<bigint[] | null> => {
      try {
        const readContract = await args.getReadContract();
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
        const readContract = await args.getReadContract();
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

    const fallbackTokenIdsFromFeed = () => {
      const out: string[] = [];
      const normalizedKey = normalized.toLowerCase();
      const chainKey = String(args.walletChainId ?? "").trim();
      for (const p of args.feedPosts) {
        if (!p?.tokenId) continue;
        if (String(p.author ?? "").toLowerCase() !== normalizedKey) continue;
        const pChain = String(p.chainId ?? "").trim();
        if (chainKey && pChain && pChain !== chainKey) continue;
        out.push(String(p.tokenId));
      }
      return Array.from(new Set(out));
    };

    // CID collection can be slow (tokenURI reads + IPFS gateway fetches).
    // Start it concurrently so the wallet tx prompt isn't blocked.
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
        const readContract = await args.getReadContract();

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
        const writeContract = await args.getWriteContract();
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

    args.setPosterAllowedByAddress((prev) => ({ ...prev, [normalized.toLowerCase()]: false }));
    args.setPosterDisapprovedEverByAddress((prev) => ({ ...prev, [normalized.toLowerCase()]: true }));
    emitPosterAllowedChanged({ address: normalized, allowed: false, disapprovedEver: true });
  }

  async function toggleModerator(addr: string) {
    const normalized = addr.trim();
    if (!isAddress(normalized)) {
      args.setApprovalsError("Invalid address");
      return;
    }

    args.setApprovalsError(null);

    // Resolve current status from contract (preferred), local cache as fallback.
    let current = !!args.moderatorsByAddress[normalized.toLowerCase()];
    try {
      // Try contract read for correctness.
      const readContract = await args.getReadContract();
      current = !!((await (readContract as any).isModerator(normalized)) as boolean);
    } catch {
      // ignore
    }

    const nextEnabled = !current;
    await args.runContractTx(nextEnabled ? "Assign moderator" : "Unassign moderator", async () => {
      const writeContract = await args.getWriteContract();
      return (writeContract as any).setModerator(normalized, nextEnabled);
    });

    args.setModeratorsByAddress((prev) => ({ ...prev, [normalized.toLowerCase()]: nextEnabled }));
  }

  return {
    addPendingApproval,
    removePending,
    approvePending,
    disapprovePending,
    resetAllAndBlock,
    toggleModerator
  };
}
