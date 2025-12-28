import type { BrowserProvider } from "ethers";
import { useCallback, useRef } from "react";
import { sleep } from "@shared/lib/time";

export function useEnsureContractDeployed(params: {
  provider: BrowserProvider | null;
  chainId: string | null;
  contractDeployed: boolean | null;
  requireContractAddress: () => string;
  setContractDeployed: (v: boolean | null) => void;
  setStatus: (v: string) => void;
}) {
  const lastDeploymentCheckRef = useRef<{
    chainId: string | null;
    address: string | null;
    ok: boolean;
    atMs: number;
  } | null>(null);

  return useCallback(async () => {
    if (!params.provider) throw new Error("Wallet not found.");
    const address = params.requireContractAddress();

    // Avoid repeatedly calling eth_getCode (some public RPCs occasionally return truncated JSON).
    // If we recently verified deployment on this chain+address, trust that cached result.
    const now = Date.now();
    const last = lastDeploymentCheckRef.current;
    if (
      params.contractDeployed === true &&
      last?.ok === true &&
      last.address?.toLowerCase() === address.toLowerCase() &&
      last.chainId === params.chainId &&
      now - last.atMs < 60_000
    ) {
      return;
    }

    const isLikelyTruncatedJson = (err: unknown) => {
      const msg = String((err as any)?.message ?? err ?? "").toLowerCase();
      return (
        msg.includes("unterminated string") ||
        msg.includes("unexpected end of json") ||
        msg.includes("invalid json") ||
        msg.includes("syntaxerror")
      );
    };

    let code: string | null = null;
    let lastError: unknown = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        code = await params.provider.getCode(address);
        lastError = null;
        break;
      } catch (err) {
        lastError = err;
        if (!isLikelyTruncatedJson(err)) break;
        await sleep(250 * (attempt + 1));
      }
    }

    if (lastError) {
      // If we previously verified deployment, don't block writes due to a transient RPC hiccup.
      if (params.contractDeployed === true) {
        lastDeploymentCheckRef.current = { chainId: params.chainId, address, ok: true, atMs: now };
        params.setStatus("RPC error while verifying contract; proceeding with last known deployed state.");
        return;
      }
      throw lastError;
    }

    if (!code || code === "0x") {
      params.setContractDeployed(false);
      lastDeploymentCheckRef.current = { chainId: params.chainId, address, ok: false, atMs: now };
      throw new Error(
        "Contract not found on this network. Switch your wallet network (e.g. Localhost 8545 / chainId 31337) or deploy the contract to the current chain."
      );
    }

    params.setContractDeployed(true);
    lastDeploymentCheckRef.current = { chainId: params.chainId, address, ok: true, atMs: now };
  }, [
    params.provider,
    params.requireContractAddress,
    params.contractDeployed,
    params.chainId,
    params.setContractDeployed,
    params.setStatus
  ]);
}
