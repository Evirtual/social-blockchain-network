import type { Post } from "@types";
import { refreshFeedFromNetworks } from "./feedRefresh";

type ContractLike = {
  ensureContractDeployedOnCurrentNetwork: () => Promise<void>;
  getReadContract: () => Promise<any>;
};

type SetPosts = (next: Post[] | ((prev: Post[]) => Post[])) => void;

export async function refreshFeed(args: {
  provider: any;
  walletAddress: string | null;
  chainId: string | null;
  account: string | null;
  contract: ContractLike;
  postsSnapshot: Post[];
  setPosts: SetPosts;
  setStatus: (s: string) => void;
  lastRefreshedAccount: string | null;
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
    shouldReportStatus: args.shouldReportStatus
  });
}
