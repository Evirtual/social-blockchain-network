import { createContext } from "react";
import type { getSocialContract } from "../contracts/socialPosts";

export type ContractState = {
  contractAddress: string | undefined;
  contractDeployed: boolean | null;
  withdrawableTipsWei: bigint;

  ownerAddress: string | null;
  isOwner: boolean;
};

export type ContractActions = {
  requireContractAddress: () => string;
  ensureContractDeployedOnCurrentNetwork: () => Promise<void>;
  getReadContract: () => Promise<ReturnType<typeof getSocialContract>>;
  getWriteContract: () => Promise<ReturnType<typeof getSocialContract>>;
  refreshContractState: () => Promise<void>;
};

export type ContractContextValue = ContractState & ContractActions;

const ContractStateContext = createContext<ContractState | null>(null);
const ContractActionsContext = createContext<ContractActions | null>(null);
const ContractContext = createContext<ContractContextValue | null>(null);

export { ContractStateContext, ContractActionsContext, ContractContext };
