import { getSocialContract } from "../contracts/socialPosts";
import type { ChainProvider } from "../types";

export type ResolveSocialPostsAddressConfig = {
  chainId: number;
  contractAddress: string;
};

type TimeoutFn = <T>(promise: Promise<T>, ms: number, label: string) => Promise<T>;

export async function resolveSocialPostsAddress(
  cfg: ResolveSocialPostsAddressConfig,
  rpcProvider: ChainProvider,
  opts?: {
    withTimeout?: TimeoutFn;
    codeTimeoutMs?: number;
    probeTimeoutMs?: number;
    label?: string;
  }
): Promise<string> {
  if (cfg.chainId !== 31337) return cfg.contractAddress;

  const candidates = [cfg.contractAddress].map((x) => String(x).trim()).filter(Boolean);

  const withTimeout = opts?.withTimeout;
  const codeTimeoutMs = opts?.codeTimeoutMs ?? 3_000;
  const probeTimeoutMs = opts?.probeTimeoutMs ?? 3_000;
  const label = opts?.label ?? `resolve address ${cfg.chainId}`;

  const isSocialPostsAt = async (address: string) => {
    try {
      const getCodePromise = rpcProvider.getCode(address) as Promise<string>;
      const code = withTimeout
        ? await withTimeout(getCodePromise, codeTimeoutMs, `${label}:code`)
        : await getCodePromise;
      if (!code || code === "0x") return false;

      const c = getSocialContract(address, rpcProvider);
      const probePromise = c.exists(1n) as Promise<boolean>;
      if (withTimeout) {
        await withTimeout(probePromise, probeTimeoutMs, `${label}:probe`);
      } else {
        await probePromise;
      }
      return true;
    } catch {
      return false;
    }
  };

  for (const addr of candidates) {
    if (await isSocialPostsAt(addr)) return addr;
  }

  return cfg.contractAddress;
}
