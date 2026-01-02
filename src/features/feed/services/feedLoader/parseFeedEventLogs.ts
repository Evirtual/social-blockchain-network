import { isAddress } from "ethers";

import type { MintedEventLite } from "../feedLoader";

export function parseFeedEventLogs(args: { readContract: any; rawLogs: any[] }) {
  const tokensNeedFullRefresh = new Set<string>();
  const tokensNeedCountersRefresh = new Set<string>();
  const burnedTokenIds = new Set<string>();

  const mintedEvents: MintedEventLite[] = [];

  for (const log of args.rawLogs) {
    const desc = args.readContract.interface?.parseLog ? args.readContract.interface.parseLog(log) : null;
    if (!desc) continue;
    const name = String((desc as any).name ?? "");
    const parsedArgs = (desc as any).args as any[] | undefined;
    if (!parsedArgs) continue;

    const tokenIdAt = (index: number): bigint | undefined => {
      const v = parsedArgs[index] as bigint | undefined;
      return typeof v === "bigint" ? v : undefined;
    };

    if (name === "PostMinted") {
      const author = parsedArgs[0] as string | undefined;
      if (author && !isAddress(author)) {
        // If the contract emitted something unexpected, ignore.
      }
      const tokenIdBig = tokenIdAt(1);
      if (!tokenIdBig) continue;
      tokensNeedFullRefresh.add(tokenIdBig.toString());
      mintedEvents.push({
        author,
        tokenIdBig,
        blockNumber:
          typeof (log as any)?.blockNumber === "number" ? (log as any).blockNumber : Number((log as any)?.blockNumber ?? 0) || undefined,
        txHash: ((log as any)?.transactionHash as string | undefined) ?? undefined
      } satisfies MintedEventLite);
      continue;
    }

    // tokenId indices mirror the previous per-event query logic.
    if (name === "PostUpdated") {
      const tokenIdBig = tokenIdAt(1);
      if (tokenIdBig) tokensNeedFullRefresh.add(tokenIdBig.toString());
      continue;
    }
    if (name === "PostUpdatedByAdmin") {
      const tokenIdBig = tokenIdAt(2);
      if (tokenIdBig) tokensNeedFullRefresh.add(tokenIdBig.toString());
      continue;
    }
    if (name === "PostBurned") {
      const tokenIdBig = tokenIdAt(1);
      if (tokenIdBig) burnedTokenIds.add(tokenIdBig.toString());
      continue;
    }
    if (name === "PostBurnedByAdmin") {
      const tokenIdBig = tokenIdAt(2);
      if (tokenIdBig) burnedTokenIds.add(tokenIdBig.toString());
      continue;
    }
    if (
      name === "PostLiked" ||
      name === "PostUnliked" ||
      name === "PostSaved" ||
      name === "PostUnsaved" ||
      name === "CommentAdded" ||
      name === "CommentDeleted"
    ) {
      const tokenIdBig = tokenIdAt(1);
      if (tokenIdBig) tokensNeedCountersRefresh.add(tokenIdBig.toString());
      continue;
    }
    if (name === "PostTipped") {
      const tokenIdBig = tokenIdAt(2);
      if (tokenIdBig) tokensNeedCountersRefresh.add(tokenIdBig.toString());
      continue;
    }
  }

  return { mintedEvents, tokensNeedFullRefresh, tokensNeedCountersRefresh, burnedTokenIds };
}
