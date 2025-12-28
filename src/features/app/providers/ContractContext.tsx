import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { getSocialContract } from "../../contract";
import {
  useContractAddress,
  useContractGetters,
  useEnsureContractDeployed,
  useRefreshContractState,
  useRefreshOwner
} from "../../contract";
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

  const chainIdNumberRef = useRef<number | null>(null);

  const { contractAddress, requireContractAddress } = useContractAddress({ chainId, chainIdNumberRef });

  const { getReadContract, getWriteContract } = useContractGetters({ provider, requireContractAddress });

  const ensureContractDeployedOnCurrentNetwork = useEnsureContractDeployed({
    provider,
    chainId,
    contractDeployed,
    requireContractAddress,
    setContractDeployed,
    setStatus
  });

  const refreshOwner = useRefreshOwner({ provider, contractAddress, setOwnerAddress });

  const isOwner = !!walletAddress && !!ownerAddress && walletAddress.toLowerCase() === ownerAddress.toLowerCase();

  const refreshContractState = useRefreshContractState({
    provider,
    chainId,
    walletAddress,
    chainIdNumberRef,
    getReadContract,
    setContractDeployed,
    setWithdrawableTipsWei
  });

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
