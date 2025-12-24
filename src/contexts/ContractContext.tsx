import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { getSocialContract } from "../contracts/socialPosts";
import { useStatus } from "./StatusContext";
import { useWallet } from "./WalletContext";

const LEGACY_CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS as string | undefined;
const CONTRACT_ADDRESS_BY_CHAIN_ID: Record<number, string | undefined> = {
  // Ethereum
  1: import.meta.env.VITE_CONTRACT_ADDRESS_ETH as string | undefined,
  11155111: import.meta.env.VITE_CONTRACT_ADDRESS_SEPOLIA as string | undefined,

  // Base
  8453: import.meta.env.VITE_CONTRACT_ADDRESS_BASE as string | undefined,
  84532: import.meta.env.VITE_CONTRACT_ADDRESS_BASE_SEPOLIA as string | undefined,

  // BNB Smart Chain (BSC)
  56: import.meta.env.VITE_CONTRACT_ADDRESS_BSC as string | undefined,
  97: import.meta.env.VITE_CONTRACT_ADDRESS_BSC_TESTNET as string | undefined,

  // Local (Hardhat)
  31337: import.meta.env.VITE_CONTRACT_ADDRESS_LOCAL as string | undefined
};

function chainIdToNumber(chainId: string | null): number | null {
  if (!chainId) return null;
  if (chainId.startsWith("0x") || chainId.startsWith("0X")) {
    const n = Number.parseInt(chainId, 16);
    return Number.isFinite(n) ? n : null;
  }
  const n = Number.parseInt(chainId, 10);
  return Number.isFinite(n) ? n : null;
}

function resolveContractAddress(chainIdNumber: number | null): string | undefined {
  if (typeof chainIdNumber === "number") {
    const mapped = CONTRACT_ADDRESS_BY_CHAIN_ID[chainIdNumber];
    if (mapped) return mapped;
  }
  return LEGACY_CONTRACT_ADDRESS;
}

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

  const chainIdNumberRef = useRef<number | null>(null);

  const contractAddress = useMemo(() => {
    const chain = chainIdToNumber(chainId);
    return resolveContractAddress(chain ?? chainIdNumberRef.current);
  }, [chainId]);

  const requireContractAddress = useCallback(() => {
    const chain = chainIdToNumber(chainId) ?? chainIdNumberRef.current;
    const resolved = resolveContractAddress(chain);
    if (resolved) return resolved;

    const chainHint = typeof chain === "number" ? ` (chainId ${chain})` : "";

    throw new Error(
      `Missing contract address${chainHint}. Set it in your environment (e.g. .env.local).\n\n` +
        `For multi-network: set VITE_CONTRACT_ADDRESS_ETH (1) and/or VITE_CONTRACT_ADDRESS_BASE (8453).\n` +
        "For local dev: run npm run deploy:local then restart the dev server."
    );
  }, [chainId]);

  const ensureContractDeployedOnCurrentNetwork = useCallback(async () => {
    if (!provider) throw new Error("Wallet not found.");
    const address = requireContractAddress();
    const code = await provider.getCode(address);
    if (!code || code === "0x") {
      setContractDeployed(false);
      throw new Error(
        "Contract not found on this network. Switch your wallet network (e.g. Localhost 8545 / chainId 31337) or deploy the contract to the current chain."
      );
    }
    setContractDeployed(true);
  }, [provider, requireContractAddress]);

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

    const addr = resolveContractAddress(chainIdToNumber(chainId) ?? chainIdNumberRef.current);
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
