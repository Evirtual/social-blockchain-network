import type { Contract, ContractRunner, Provider } from "ethers";

export type SocialPostsContract = Contract;
export type ContractRunnerLike = ContractRunner;
export type ChainProvider = Provider;

export type ReadContractFactory = () => Promise<SocialPostsContract>;
export type WriteContractFactory = () => Promise<SocialPostsContract>;
