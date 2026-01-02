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

  // Optional: The Graph subgraph URLs for stable feed loading
  readonly VITE_ETH_SUBGRAPH_URL?: string;
  readonly VITE_ETH_SEPOLIA_SUBGRAPH_URL?: string;
  readonly VITE_BASE_SUBGRAPH_URL?: string;
  readonly VITE_BASE_SEPOLIA_SUBGRAPH_URL?: string;
  readonly VITE_BSC_SUBGRAPH_URL?: string;
  readonly VITE_BSC_TESTNET_SUBGRAPH_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare global {
  type EthereumRequestArgs = {
    method: string;
    params?: Array<
      | string
      | number
      | boolean
      | null
      | undefined
      | Record<string, string | number | boolean | null | undefined>
    >;
  };

  type EthereumProvider = {
    request?: (args: EthereumRequestArgs) => Promise<null>;
    on?: (event: string, handler: (...args: Array<string | string[]>) => void) => void;
    removeListener?: (event: string, handler: (...args: Array<string | string[]>) => void) => void;
  };

  interface Window {
    ethereum?: EthereumProvider;
  }
}

export {};
