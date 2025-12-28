import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { getSocialContract } from "../contracts/socialPosts";
import { parseChainIdNumber } from "../lib/chainId";
import { resolveConfiguredSocialPostsAddress } from "../lib/configuredSocialPostsAddress";
import { useStatus } from "./StatusContext";
import { useWallet } from "./WalletContext";

export type ContractContextValue = {
  contractAddress: string | undefined;
  contractDeployed: boolean | null;
  withdrawableTipsWei: bigint;

  ownerAddress: string | null;
  isOwner: boolean;

  requireContractAddress: () => string;
  ensureContractDeployedOnCurrentNetwork: () => Promise<void>;
  getReadContract: () => Promise<ReturnType<typeof getSocialContract>>;
  getWriteContract: () => Promise<ReturnType<typeof getSocialContract>>;

  refreshContractState: () => Promise<void>;
};

const ContractContext = createContext<ContractContextValue | null>(null);

export function ContractProvider({ children }: { children: React.ReactNode }) {
  const { provider, chainId, walletAddress } = useWallet();
  const { setStatus } = useStatus();

  const [contractDeployed, setContractDeployed] = useState<boolean | null>(null);
  const [withdrawableTipsWei, setWithdrawableTipsWei] = useState<bigint>(0n);
  const [ownerAddress, setOwnerAddress] = useState<string | null>(null);

  const lastDeploymentCheckRef = useRef<{
    chainId: string | null;
    address: string | null;
    ok: boolean;
    atMs: number;
  } | null>(null);

  const chainIdNumberRef = useRef<number | null>(null);

  const contractAddress = useMemo(() => {
    const chain = parseChainIdNumber(chainId);
    return resolveConfiguredSocialPostsAddress(chain ?? chainIdNumberRef.current);
  }, [chainId]);

  const requireContractAddress = useCallback(() => {
    const chain = parseChainIdNumber(chainId) ?? chainIdNumberRef.current;
    const resolved = resolveConfiguredSocialPostsAddress(chain);
    if (resolved) return resolved;

    const chainHint = typeof chain === "number" ? ` (chainId ${chain})` : "";

    throw new Error(
      `Missing contract address${chainHint}. Set it in your environment (e.g. .env.local).\n\n` +
        `For multi-network: set VITE_CONTRACT_ADDRESS_ETH (1) and/or VITE_CONTRACT_ADDRESS_BASE (8453).\n` +
        "For local dev: set VITE_CONTRACT_ADDRESS after deploy:local, then restart the dev server."
    );
  }, [chainId]);

  const ensureContractDeployedOnCurrentNetwork = useCallback(async () => {
    if (!provider) throw new Error("Wallet not found.");
    const address = requireContractAddress();

    // Avoid repeatedly calling eth_getCode (some public RPCs occasionally return truncated JSON).
    // If we recently verified deployment on this chain+address, trust that cached result.
    const now = Date.now();
    const last = lastDeploymentCheckRef.current;
    if (
      contractDeployed === true &&
      last?.ok === true &&
      last.address?.toLowerCase() === address.toLowerCase() &&
      last.chainId === chainId &&
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

    const sleep = (ms: number) => new Promise((r) => window.setTimeout(r, ms));

    let code: string | null = null;
    let lastError: unknown = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        code = await provider.getCode(address);
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
      if (contractDeployed === true) {
        lastDeploymentCheckRef.current = { chainId, address, ok: true, atMs: now };
        setStatus("RPC error while verifying contract; proceeding with last known deployed state.");
        return;
      }
      throw lastError;
    }

    if (!code || code === "0x") {
      setContractDeployed(false);
      lastDeploymentCheckRef.current = { chainId, address, ok: false, atMs: now };
      throw new Error(
        "Contract not found on this network. Switch your wallet network (e.g. Localhost 8545 / chainId 31337) or deploy the contract to the current chain."
      );
    }

    setContractDeployed(true);
    lastDeploymentCheckRef.current = { chainId, address, ok: true, atMs: now };
  }, [provider, requireContractAddress, contractDeployed, chainId, setStatus]);

  const getWriteContract = useCallback(async () => {
    if (!provider) throw new Error("Wallet not found.");
    const signer = await provider.getSigner();
    const address = requireContractAddress();
    return getSocialContract(address, signer);
  }, [provider, requireContractAddress]);

  const getReadContract = useCallback(async () => {
    if (!provider) throw new Error("Wallet not found.");
    const address = requireContractAddress();
    return getSocialContract(address, provider);
  }, [provider, requireContractAddress]);

  const refreshOwner = useCallback(async () => {
    if (!provider) {
      setOwnerAddress(null);
      return;
    }

    const addr = contractAddress;
    if (!addr) {
      setOwnerAddress(null);
      return;
    }

    try {
      const readContract = getSocialContract(addr, provider);
      const o = (await (readContract as any).owner()) as string;
      setOwnerAddress(o);
    } catch {
      setOwnerAddress(null);
    }
  }, [provider, contractAddress]);

  const isOwner =
    !!walletAddress && !!ownerAddress && walletAddress.toLowerCase() === ownerAddress.toLowerCase();

  const refreshContractState = useCallback(async () => {
    if (!provider) return;

    try {
      const network = await provider.getNetwork();
      chainIdNumberRef.current = Number(network.chainId);
    } catch {
      // ignore
    }

    const addr = resolveConfiguredSocialPostsAddress(parseChainIdNumber(chainId) ?? chainIdNumberRef.current);
    if (!addr) {
      setContractDeployed(null);
      setWithdrawableTipsWei(0n);
      return;
    }

    try {
      const code = await provider.getCode(addr);
      setContractDeployed(Boolean(code && code !== "0x"));
    } catch {
      setContractDeployed(null);
    }

    try {
      if (!walletAddress) {
        setWithdrawableTipsWei(0n);
        return;
      }
      const readContract = await getReadContract();
      const w = (await (readContract as any).withdrawableOf(walletAddress)) as bigint;
      setWithdrawableTipsWei(w);
    } catch {
      // ignore
    }
  }, [provider, chainId, walletAddress, getReadContract]);

  // Keep contract state in sync with wallet/provider changes.
  useEffect(() => {
    void refreshContractState();
  }, [refreshContractState]);

  // Keep owner in sync with wallet/provider/contract changes.
  useEffect(() => {
    void refreshOwner();
  }, [refreshOwner]);

  // Friendly hint when wallet connects but contract address is missing.
  useEffect(() => {
    if (!walletAddress) return;
    if (contractAddress) return;
    setStatus(
      "Wallet connected, but no contract address is configured for this network. Set VITE_CONTRACT_ADDRESS_* in .env.local, then restart the dev server."
    );
  }, [walletAddress, contractAddress, setStatus]);

  const value = useMemo<ContractContextValue>(
    () => ({
      contractAddress,
      contractDeployed,
      withdrawableTipsWei,

      ownerAddress,
      isOwner,

      requireContractAddress,
      ensureContractDeployedOnCurrentNetwork,
      getReadContract,
      getWriteContract,
      refreshContractState
    }),
    [
      contractAddress,
      contractDeployed,
      withdrawableTipsWei,

      ownerAddress,
      isOwner,

      requireContractAddress,
      ensureContractDeployedOnCurrentNetwork,
      getReadContract,
      getWriteContract,
      refreshContractState
    ]
  );

  return <ContractContext.Provider value={value}>{children}</ContractContext.Provider>;
}

export function useContract() {
  const ctx = useContext(ContractContext);
  if (!ctx) throw new Error("useContract must be used within <ContractProvider>");
  return ctx;
}
