import type { Post } from "@types";

import type { MintedEventLite } from "./feedLoader";
import { refreshFeedFromNetworks } from "./feedRefresh";

type ContractLike = {
  ensureContractDeployedOnCurrentNetwork: () => Promise<void>;
  getReadContract: () => Promise<any>;
};

type SetPosts = (next: Post[] | ((prev: Post[]) => Post[])) => void;

export type FeedRefreshCaches = {
  mintedEventsCache: Map<string, { lastScannedBlock: number; events: MintedEventLite[] }>;
  blockTimestampCache: Map<string, Map<number, number>>;
  existsPruneCursor: Map<string, number>;
};

export async function refreshFeedWithCaches(args: {
  provider: any;
  walletAddress: string | null;
  chainId: string | null;
  account: string | null;
  contract: ContractLike;
  postsSnapshot: Post[];
  setPosts: SetPosts;
  setStatus: (s: string) => void;
  lastRefreshedAccount: string | null;
  caches: FeedRefreshCaches;
  shouldReportStatus: boolean;
}) {
  return refreshFeedFromNetworks({
    provider: args.provider,
    walletAddress: args.walletAddress,
    chainId: args.chainId,
    account: args.account,
    contract: args.contract,
    postsSnapshot: args.postsSnapshot,
    setPosts: args.setPosts,
    setStatus: args.setStatus,
    lastRefreshedAccount: args.lastRefreshedAccount,
    caches: args.caches,
    shouldReportStatus: args.shouldReportStatus
  });
}
