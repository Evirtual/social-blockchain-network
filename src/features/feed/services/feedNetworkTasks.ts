import type { Post } from "@types";
import { getSocialContract, type ChainProvider, type ReadContractFactory, type SocialPostsContract } from "@features/contract";
import type { FeedNetworkConfig } from "./feedNetworks";

export async function getFeedNetworkTasks(args: {
  currentChainIdNumber: number | null;
  configuredNetworks: FeedNetworkConfig[];
  extraNetworks: FeedNetworkConfig[];
  provider: ChainProvider | null | undefined;
  walletAddress: string | null | undefined;

  skipCurrentNetwork?: boolean;

  ensureContractDeployedOnCurrentNetwork: () => Promise<void>;
  getReadContract: ReadContractFactory;

  getRpcProvider: (url: string, chainIdNum: number) => ChainProvider;
  resolveRpcContractAddress: (cfg: FeedNetworkConfig, rpcProvider: ChainProvider) => Promise<string>;

  taskTimeoutMs: number;
  withTimeout: <T>(promise: Promise<T>, ms: number, label: string) => Promise<T>;

  loadFromProvider: (
    chainIdNum: number | null,
    networkProvider: ChainProvider | null,
    readContract: SocialPostsContract | null
  ) => Promise<Post[]>;
  onLoaded: (loaded: Post[]) => void;
}): Promise<Array<Promise<Post[]>>> {
  const {
    currentChainIdNumber,
    configuredNetworks,
    extraNetworks,
    provider,
    walletAddress,
    skipCurrentNetwork,
    ensureContractDeployedOnCurrentNetwork,
    getReadContract,
    getRpcProvider,
    resolveRpcContractAddress,
    taskTimeoutMs,
    withTimeout,
    loadFromProvider,
    onLoaded
  } = args;

  const tasks: Array<Promise<Post[]>> = [];

  const enqueueLoad = (label: string, promise: Promise<Post[]>) => {
    tasks.push(
      withTimeout(promise, taskTimeoutMs, label).then((loaded) => {
        onLoaded(loaded);
        return loaded;
      })
    );
  };

  // Current chain
  if (!skipCurrentNetwork && currentChainIdNumber != null) {
    const currentCfg = configuredNetworks.find((n) => n.chainId === currentChainIdNumber);
    const currentRpcUrl = typeof currentCfg?.rpcUrl === "string" ? currentCfg.rpcUrl.trim() : "";

    // When disconnected, prefer a public RPC for reads.
    if (!walletAddress && currentCfg && currentRpcUrl) {
      const rpcProvider = getRpcProvider(currentRpcUrl, currentCfg.chainId);
      enqueueLoad(
        `Feed network ${currentCfg.chainId}`,
        (async () => {
          const addr = await resolveRpcContractAddress(currentCfg, rpcProvider);
          const remoteReadContract = getSocialContract(addr, rpcProvider);
          return loadFromProvider(currentCfg.chainId, rpcProvider, remoteReadContract);
        })()
      );
    } else if (provider) {
      enqueueLoad(
        `Feed network ${currentChainIdNumber}`,
        (async () => {
          try {
            await ensureContractDeployedOnCurrentNetwork();
            const currentReadContract = await getReadContract();
            return await loadFromProvider(currentChainIdNumber, provider, currentReadContract);
          } catch {
            // If the connected network isn't configured, still try any configured read-only networks.
            return [];
          }
        })()
      );
    } else if (currentCfg) {
      enqueueLoad(`Feed network ${currentChainIdNumber}`, loadFromProvider(currentChainIdNumber, null, null));
    }
  } else if (!skipCurrentNetwork && provider) {
    // ChainId not resolved yet; fall back to injected provider.
    enqueueLoad(
      "Feed current network",
      (async () => {
        try {
          await ensureContractDeployedOnCurrentNetwork();
          const currentReadContract = await getReadContract();
          return await loadFromProvider(currentChainIdNumber, provider, currentReadContract);
        } catch {
          return [];
        }
      })()
    );
  }

  // Other chains
  for (const cfg of extraNetworks) {
    const url = typeof cfg.rpcUrl === "string" ? cfg.rpcUrl.trim() : "";
    if (url) {
      const rpcProvider = getRpcProvider(url, cfg.chainId);
      enqueueLoad(
        `Feed network ${cfg.chainId}`,
        (async () => {
          const addr = await resolveRpcContractAddress(cfg, rpcProvider);
          const remoteReadContract = getSocialContract(addr, rpcProvider);
          return loadFromProvider(cfg.chainId, rpcProvider, remoteReadContract);
        })()
      );
    } else {
      enqueueLoad(`Feed network ${cfg.chainId}`, loadFromProvider(cfg.chainId, null, null));
    }
  }

  return tasks;
}
