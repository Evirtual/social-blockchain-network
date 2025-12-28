/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CONTRACT_ADDRESS?: string;
  readonly VITE_CONTRACT_ADDRESS_ETH?: string;
  readonly VITE_CONTRACT_ADDRESS_SEPOLIA?: string;
  readonly VITE_CONTRACT_ADDRESS_BASE?: string;
  readonly VITE_CONTRACT_ADDRESS_BASE_SEPOLIA?: string;
  readonly VITE_CONTRACT_ADDRESS_BSC?: string;
  readonly VITE_CONTRACT_ADDRESS_BSC_TESTNET?: string;
  readonly VITE_LOCAL_RPC_URL?: string;
  readonly VITE_PINATA_JWT?: string;
  readonly VITE_PINATA_API_KEY?: string;
  readonly VITE_PINATA_API_SECRET?: string;
  readonly VITE_IPFS_GATEWAY?: string;
  readonly [key: `VITE_EXPLORER_BASE_URL_${string}`]: string | undefined;

  readonly VITE_FEED_LOOKBACK_BLOCKS?: string;
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
