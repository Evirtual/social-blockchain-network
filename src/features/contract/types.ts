import type { Contract, Provider } from "ethers";

export type SocialPostsContract = Contract;
export type ChainProvider = Provider;

export type ReadContractFactory = () => Promise<SocialPostsContract>;
export type WriteContractFactory = () => Promise<SocialPostsContract>;
