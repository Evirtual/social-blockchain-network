import type { Post } from "@types";
import { getSocialContract } from "../../contract";
import type { FeedNetworkConfig } from "./feedNetworks";

export async function getFeedNetworkTasks(args: {
  currentChainIdNumber: number | null;
  configuredNetworks: FeedNetworkConfig[];
  extraNetworks: FeedNetworkConfig[];
  provider: any | null | undefined;
  walletAddress: string | null | undefined;

  ensureContractDeployedOnCurrentNetwork: () => Promise<void>;
  getReadContract: () => Promise<any>;

  getRpcProvider: (url: string, chainIdNum: number) => any;
  resolveRpcContractAddress: (cfg: FeedNetworkConfig, rpcProvider: any) => Promise<string>;

  taskTimeoutMs: number;
  withTimeout: <T>(promise: Promise<T>, ms: number, label: string) => Promise<T>;

  loadFromProvider: (chainIdNum: number | null, networkProvider: any, readContract: any) => Promise<Post[]>;
  onLoaded: (loaded: Post[]) => void;
}): Promise<Array<Promise<Post[]>>> {
  const {
    currentChainIdNumber,
    configuredNetworks,
    extraNetworks,
    provider,
    walletAddress,
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
  if (currentChainIdNumber != null) {
    const currentCfg = configuredNetworks.find((n) => n.chainId === currentChainIdNumber);
    const currentRpcUrl = typeof currentCfg?.rpcUrl === "string" ? currentCfg.rpcUrl.trim() : "";

    // When disconnected, prefer a public RPC for reads.
    if (!walletAddress && currentCfg && currentRpcUrl) {
      const rpcProvider: any = getRpcProvider(currentRpcUrl, currentCfg.chainId);
      enqueueLoad(
        `Feed network ${currentCfg.chainId}`,
        (async () => {
          const addr = await resolveRpcContractAddress(currentCfg, rpcProvider);
          const remoteReadContract = getSocialContract(addr, rpcProvider);
          return loadFromProvider(currentCfg.chainId, rpcProvider, remoteReadContract);
        })()
      );
    } else if (provider) {
      try {
        await ensureContractDeployedOnCurrentNetwork();
        const currentReadContract = await getReadContract();
        enqueueLoad(`Feed network ${currentChainIdNumber}`, loadFromProvider(currentChainIdNumber, provider, currentReadContract));
      } catch {
        // If the connected network isn't configured, still try any configured read-only networks.
      }
    }
  } else if (provider) {
    // ChainId not resolved yet; fall back to injected provider.
    try {
      await ensureContractDeployedOnCurrentNetwork();
      const currentReadContract = await getReadContract();
      enqueueLoad("Feed current network", loadFromProvider(currentChainIdNumber, provider, currentReadContract));
    } catch {
      // ignore
    }
  }

  // Other chains
  for (const cfg of extraNetworks) {
    const url = String(cfg.rpcUrl).trim();
    const rpcProvider: any = getRpcProvider(url, cfg.chainId);
    enqueueLoad(
      `Feed network ${cfg.chainId}`,
      (async () => {
        const addr = await resolveRpcContractAddress(cfg, rpcProvider);
        const remoteReadContract = getSocialContract(addr, rpcProvider);
        return loadFromProvider(cfg.chainId, rpcProvider, remoteReadContract);
      })()
    );
  }

  return tasks;
}
