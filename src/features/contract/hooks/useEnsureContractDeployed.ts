import type { BrowserProvider } from "ethers";
import { useCallback } from "react";
import { sleep } from "@shared/lib/time";

export function useEnsureContractDeployed(params: {
  provider: BrowserProvider | null;
  chainId: string | null;
  contractDeployed: boolean | null;
  requireContractAddress: () => string;
  setContractDeployed: (v: boolean | null) => void;
  setStatus: (v: string) => void;
}) {
  return useCallback(async () => {
    if (!params.provider) throw new Error("Wallet not found.");
    const address = params.requireContractAddress();

    type ErrorInput = Error | { message?: string } | string | null;
    const isLikelyTruncatedJson = (err: ErrorInput) => {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message?: string }).message ?? "")
          : String(err ?? "");
      const lower = msg.toLowerCase();
      return (
        lower.includes("unterminated string") ||
        lower.includes("unexpected end of json") ||
        lower.includes("invalid json") ||
        lower.includes("syntaxerror")
      );
    };

    let code: string | null = null;
    let lastError: ErrorInput = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        code = await params.provider.getCode(address);
        lastError = null;
        break;
      } catch (err) {
        const errInput = err as ErrorInput;
        lastError = errInput;
        if (!isLikelyTruncatedJson(errInput)) break;
        await sleep(250 * (attempt + 1));
      }
    }

    if (lastError) {
      throw lastError;
    }

    if (!code || code === "0x") {
      params.setContractDeployed(false);
      throw new Error(
        "Contract not found on this network. Switch your wallet network (e.g. Localhost 8545 / chainId 31337) or deploy the contract to the current chain."
      );
    }

    params.setContractDeployed(true);
  }, [
    params.provider,
    params.requireContractAddress,
    params.contractDeployed,
    params.chainId,
    params.setContractDeployed,
    params.setStatus
  ]);
}
