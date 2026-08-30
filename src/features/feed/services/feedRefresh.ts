import type { Post } from "@types";
import { withTimeout } from "@shared/lib/feedQuery";
import { getRpcProvider } from "@shared/lib/rpc";
import { parseChainIdNumber } from "@shared/lib/chainId";
import { getSubgraphUrlForChainId } from "@shared/lib/subgraph";
import { postKey } from "@features/post/services";
import { loadFeedFromProvider } from "./feedLoader";
import { mergePosts } from "./feedPosts";
import { getFeedNetworkTasks } from "./feedNetworkTasks";
import { loadFeedFromSubgraph } from "./subgraph/loadFeedFromSubgraph";
import { getFeedRefreshConfig } from "../hooks/refresh/getFeedRefreshConfig";
import { createResolveRpcContractAddress } from "../hooks/refresh/createResolveRpcContractAddress";
import { getEnv } from "@shared/lib/env";
import type { ChainProvider, ReadContractFactory, SocialPostsContract } from "@features/contract/types";

type ContractLike = {
  ensureContractDeployedOnCurrentNetwork: () => Promise<void>;
  getReadContract: ReadContractFactory;
};

type FeedRefreshArgs = {
  provider: ChainProvider | null;
  walletAddress: string | null;
  chainId: string | null;
  account: string | null;
  selectedNetworkChainIds: string[];
  targetChainIdNum?: number | null;
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
    selectedNetworkChainIds,
    targetChainIdNum,
    contract,
    postsSnapshot,
    setPosts,
    setStatus,
    lastRefreshedAccount,
    shouldReportStatus
  } = args;

  const isVitest = typeof (globalThis as { __vitest_worker__?: boolean }).__vitest_worker__ !== "undefined";
  const normalizedAccount = typeof account === "string" ? account.toLowerCase() : null;

  const currentChainIdNumber = parseChainIdNumber(chainId);
  const env = getEnv();
  const { maxLookbackBlocks, configuredNetworks, extraNetworks } = getFeedRefreshConfig({
    env,
    currentChainIdNumber
  });

  const selectedIdsRaw = Array.isArray(selectedNetworkChainIds) ? selectedNetworkChainIds : [];
  const targetChainIdStr = targetChainIdNum != null ? String(targetChainIdNum) : null;
  const selectedIds = targetChainIdStr ? [targetChainIdStr] : selectedIdsRaw;
  const selectedSet = new Set(selectedIds.map((id) => String(id)));

  // If the user explicitly selected zero networks, show an empty feed.
  // (Default selection is handled upstream via session storage initialization.)
  if (selectedIds.length === 0) {
    setPosts([]);
    if (shouldReportStatus) setStatus("No networks selected.");
    return;
  }

  if (targetChainIdStr && !selectedIdsRaw.map(String).includes(targetChainIdStr)) {
    return;
  }

  const hasSelectedNetworks = selectedSet.size > 0;

  const filteredConfiguredNetworks = hasSelectedNetworks
    ? configuredNetworks.filter((n) => selectedSet.has(String(n.chainId)))
    : configuredNetworks;

  const filteredExtraNetworks = hasSelectedNetworks
    ? extraNetworks.filter((n) => selectedSet.has(String(n.chainId)))
    : extraNetworks;

  if (!provider && extraNetworks.length === 0) return;

  const resolveRpcContractAddress = createResolveRpcContractAddress({ withTimeout });

  // Phase 1: try subgraph first for every selected network.
  // This avoids *any* RPC calls (wallet provider / public RPC) during normal operation.
  const subgraphAttempts: Array<Promise<{ chainIdNum: number; ok: true } | { chainIdNum: number; ok: false }>> = [];
  const subgraphOkChainIds = new Set<number>();
  const subgraphFailedChainIds = new Set<number>();

  const enqueueSubgraphAttempt = (chainIdNum: number) => {
    const subgraphUrl = getSubgraphUrlForChainId(env, chainIdNum);
    if (!subgraphUrl) return;

    const chainIdStr = String(chainIdNum);
    const label = `Feed subgraph ${chainIdStr}`;
    const task = withTimeout(
      (async () => {
        const loaded = await loadFeedFromSubgraph({
          url: subgraphUrl,
          chainIdStr,
          first: 200,
          account: normalizedAccount
        });
        setPosts((prev) => mergePosts(prev, loaded, postKey));
        subgraphOkChainIds.add(chainIdNum);
        return { chainIdNum, ok: true as const };
      })(),
      25_000,
      label
    ).catch(() => {
      subgraphFailedChainIds.add(chainIdNum);
      return { chainIdNum, ok: false as const };
    });

    subgraphAttempts.push(task);
  };

  if (currentChainIdNumber != null && selectedSet.has(String(currentChainIdNumber))) {
    enqueueSubgraphAttempt(currentChainIdNumber);
  }

  for (const cfg of filteredExtraNetworks) {
    enqueueSubgraphAttempt(cfg.chainId);
  }

  if (subgraphAttempts.length > 0) {
    await Promise.all(subgraphAttempts);
  }

  // Phase 2: RPC fallback only for networks where subgraph is missing or failed.
  const extraNetworksForRpcFallback = filteredExtraNetworks.filter((cfg) => {
    const hasSubgraph = !!getSubgraphUrlForChainId(env, cfg.chainId);
    if (!hasSubgraph) return true;
    return subgraphFailedChainIds.has(cfg.chainId);
  });

  const skipCurrentNetworkRpc =
    currentChainIdNumber != null &&
    selectedSet.has(String(currentChainIdNumber)) &&
    subgraphOkChainIds.has(currentChainIdNumber);

  const loadFromProvider = async (
    chainIdNum: number | null,
    networkProvider: ChainProvider | null,
    readContract: SocialPostsContract | null
  ): Promise<Post[]> => {
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
    configuredNetworks: filteredConfiguredNetworks,
    extraNetworks: extraNetworksForRpcFallback,
    provider,
    walletAddress: walletAddress ?? null,
    ensureContractDeployedOnCurrentNetwork: contract.ensureContractDeployedOnCurrentNetwork,
    getReadContract: contract.getReadContract,
    getRpcProvider,
    resolveRpcContractAddress,
    skipCurrentNetwork: skipCurrentNetworkRpc,
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
