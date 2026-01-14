import { createContext } from "react";
import { createStableContext } from "@shared/lib/createStableContext";
import type { getSocialContract } from "../contracts/socialPosts";

export type ContractState = {
  contractAddress: string | undefined;
  contractDeployed: boolean | null;
  withdrawableTipsWei: bigint;

  withdrawFeeBps: number;

  tipSupportPreferenceBps: number;

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

const ContractStateContext = createStableContext("__sbnetContractStateContext", () =>
  createContext<ContractState | null>(null)
);
const ContractActionsContext = createStableContext("__sbnetContractActionsContext", () =>
  createContext<ContractActions | null>(null)
);
const ContractContext = createStableContext("__sbnetContractContext", () =>
  createContext<ContractContextValue | null>(null)
);

export { ContractStateContext, ContractActionsContext, ContractContext };
