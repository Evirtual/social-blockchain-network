/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CONTRACT_ADDRESS?: string;
  readonly VITE_PINATA_JWT?: string;
  readonly VITE_IPFS_GATEWAY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface ImportMetaEnv {
  readonly VITE_CONTRACT_ADDRESS?: string;
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
