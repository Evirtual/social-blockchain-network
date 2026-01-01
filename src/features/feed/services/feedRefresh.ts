import type { Post } from "@types";
import { withTimeout } from "@shared/lib/feedQuery";
import { getRpcProvider } from "@shared/lib/rpc";
import { parseChainIdNumber } from "@shared/lib/chainId";
import { getSubgraphUrlForChainId } from "@shared/lib/subgraph";
import { postKey } from "@shared/lib/post";
import { loadFeedFromProvider } from "./feedLoader";
import { mergePosts } from "./feedPosts";
import { getFeedNetworkTasks } from "./feedNetworkTasks";
import { loadFeedFromSubgraph } from "./subgraph/loadFeedFromSubgraph";
import { getFeedRefreshConfig } from "../hooks/refresh/getFeedRefreshConfig";
import { createResolveRpcContractAddress } from "../hooks/refresh/createResolveRpcContractAddress";

type ContractLike = {
  ensureContractDeployedOnCurrentNetwork: () => Promise<void>;
  getReadContract: () => Promise<any>;
};

type FeedRefreshArgs = {
  provider: any;
  walletAddress: string | null;
  chainId: string | null;
  account: string | null;
  contract: ContractLike;
  postsSnapshot: Post[];
  setPosts: React.Dispatch<React.SetStateAction<Post[]>>;
  setStatus: (s: string) => void;
  lastRefreshedAccount: string | null;
  shouldReportStatus: boolean;
};

export async function refreshFeedFromNetworks(args: FeedRefreshArgs): Promise<void> {
  const {
    provider,
    walletAddress,
    chainId,
    account,
    contract,
    postsSnapshot,
    setPosts,
    setStatus,
    lastRefreshedAccount,
    shouldReportStatus
  } = args;

  const isVitest = typeof (globalThis as any).__vitest_worker__ !== "undefined";
  const normalizedAccount = typeof account === "string" ? account.toLowerCase() : null;

  const currentChainIdNumber = parseChainIdNumber(chainId);
  const env = import.meta.env as any;
  const { maxLookbackBlocks, configuredNetworks, extraNetworks } = getFeedRefreshConfig({
    env,
    currentChainIdNumber
  });

  if (!provider && extraNetworks.length === 0) return;

  const resolveRpcContractAddress = createResolveRpcContractAddress({ withTimeout });

  const loadFromProvider = async (chainIdNum: number | null, networkProvider: any, readContract: any): Promise<Post[]> => {
    const subgraphUrl = getSubgraphUrlForChainId(env, chainIdNum);
    if (subgraphUrl) {
      const chainIdStr = chainIdNum != null ? String(chainIdNum) : undefined;
      try {
        return await loadFeedFromSubgraph({
          url: subgraphUrl,
          chainIdStr,
          first: 200,
          account: normalizedAccount
        });
      } catch {
        // Subgraphs can take a few minutes to start syncing after deploy.
        // During that warm-up window, keep the app functional by falling back to RPC scanning.
      }
    }
    if (!networkProvider || !readContract) return [];
    return await loadFeedFromProvider({
      chainIdNum,
      networkProvider,
      readContract,
      maxLookbackBlocks,
      account: account ?? null,
      lastRefreshedAccount,
      postsSnapshot,
      postKey,
      pruneByKeys: (keys) => setPosts((prev) => prev.filter((p) => !keys.has(postKey(p))))
    });
  };

  const networkTasks = await getFeedNetworkTasks({
    currentChainIdNumber,
    configuredNetworks,
    extraNetworks,
    provider,
    walletAddress: walletAddress ?? null,
    ensureContractDeployedOnCurrentNetwork: contract.ensureContractDeployedOnCurrentNetwork,
    getReadContract: contract.getReadContract,
    getRpcProvider,
    resolveRpcContractAddress,
    taskTimeoutMs: 25_000,
    withTimeout,
    loadFromProvider,
    onLoaded: (loaded) => setPosts((prev) => mergePosts(prev, loaded, postKey))
  });

  const settled = await Promise.allSettled(networkTasks);
  const fulfilled = settled.filter((r): r is PromiseFulfilledResult<Post[]> => r.status === "fulfilled");
  const rejected = settled.filter((r): r is PromiseRejectedResult => r.status === "rejected");

  const anyFulfilled = fulfilled.length > 0;
  if (!anyFulfilled && rejected.length > 0) {
    const warnSomeNetworksFailedToLoad = [
      // eslint-disable-next-line no-console
      console.warn.bind(console),
      () => {}
    ][Number(isVitest)];

    warnSomeNetworksFailedToLoad(
      "Some feed networks failed to load:",
      rejected.map((r) => r.reason)
    );

    throw rejected[0].reason;
  }

  if (shouldReportStatus) {
    setStatus(rejected.length > 0 ? "Feed loaded (some networks failed)." : "Feed loaded.");
  }
}
