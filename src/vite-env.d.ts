/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CONTRACT_ADDRESS?: string;
  readonly VITE_CONTRACT_ADDRESS_ETH?: string;
  readonly VITE_CONTRACT_ADDRESS_SEPOLIA?: string;
  readonly VITE_CONTRACT_ADDRESS_BASE?: string;
  readonly VITE_CONTRACT_ADDRESS_BASE_SEPOLIA?: string;
  readonly VITE_CONTRACT_ADDRESS_BSC?: string;
  readonly VITE_CONTRACT_ADDRESS_BSC_TESTNET?: string;
  readonly VITE_RPC_URL_ETH?: string;
  readonly VITE_RPC_URL_SEPOLIA?: string;
  readonly VITE_RPC_URL_BASE?: string;
  readonly VITE_RPC_URL_BASE_SEPOLIA?: string;
  readonly VITE_RPC_URL_BSC?: string;
  readonly VITE_RPC_URL_BSC_TESTNET?: string;
  readonly VITE_PINATA_JWT?: string;
  readonly VITE_IPFS_GATEWAY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare global {
  interface Window {
    ethereum?: unknown;
  }
}

export {};
