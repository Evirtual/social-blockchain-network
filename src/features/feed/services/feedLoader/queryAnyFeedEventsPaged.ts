import { queryLogsPagedRaw } from "@shared/lib/feedQuery";
import { buildFeedTopics0 } from "./buildFeedTopics0";
import { getContractAddress } from "./getContractAddress";
import type { ChainProvider, SocialPostsContract } from "@features/contract";

export async function queryAnyFeedEventsPaged(args: {
  networkProvider: ChainProvider;
  readContract: SocialPostsContract;
  fromBlock: number;
  toBlock: number;
  chainLabel: string;
}) {
  const topics0 = await buildFeedTopics0(args.readContract);
  const address = getContractAddress(args.readContract);
  if (!address) return [];

  return await queryLogsPagedRaw({
    provider: args.networkProvider,
    address,
    topics: [topics0],
    fromBlock: args.fromBlock,
    toBlock: args.toBlock,
    label: `feed events ${args.chainLabel}`
  });
}
