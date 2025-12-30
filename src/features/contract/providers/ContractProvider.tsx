import { useEffect, useMemo, useRef, useState } from "react";
import {
  useContractAddress,
  useContractGetters,
  useEnsureContractDeployed,
  useRefreshContractState,
  useRefreshOwner
} from "../hooks";
import { useStatusActions } from "@features/status";
import { useWalletState } from "@features/wallet";
import {
  ContractActionsContext,
  ContractContext,
  ContractStateContext,
  type ContractActions,
  type ContractContextValue,
  type ContractState
} from "./contractStateContext";

export type { ContractContextValue } from "./contractStateContext";

export function ContractProvider({ children }: { children: React.ReactNode }) {
  const { provider, chainId, walletAddress } = useWalletState();
  const { setStatus } = useStatusActions();

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

  const stateValue = useMemo<ContractState>(
    () => ({
      contractAddress,
      contractDeployed,
      withdrawableTipsWei,
      ownerAddress,
      isOwner
    }),
    [contractAddress, contractDeployed, withdrawableTipsWei, ownerAddress, isOwner]
  );

  const actionsValue = useMemo<ContractActions>(
    () => ({
      requireContractAddress,
      ensureContractDeployedOnCurrentNetwork,
      getReadContract,
      getWriteContract,
      refreshContractState
    }),
    [
      requireContractAddress,
      ensureContractDeployedOnCurrentNetwork,
      getReadContract,
      getWriteContract,
      refreshContractState
    ]
  );

  const value = useMemo<ContractContextValue>(() => ({ ...stateValue, ...actionsValue }), [stateValue, actionsValue]);

  return (
    <ContractStateContext.Provider value={stateValue}>
      <ContractActionsContext.Provider value={actionsValue}>
        <ContractContext.Provider value={value}>{children}</ContractContext.Provider>
      </ContractActionsContext.Provider>
    </ContractStateContext.Provider>
  );
}
