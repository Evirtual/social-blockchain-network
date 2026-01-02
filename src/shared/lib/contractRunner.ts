import type { ContractRunner, Provider } from "ethers";
import type { SocialPostsContract } from "@features/contract";

export function getScanProviderFromReadContract(
  readContract: SocialPostsContract | null | undefined,
  fallback?: Provider | null
): Provider | null {
  const runner: ContractRunner | null | undefined = readContract?.runner ?? null;
  if (!runner) return fallback ?? null;

  const provider = "provider" in runner ? runner.provider : null;
  return provider ?? (runner as Provider) ?? fallback ?? null;
}
