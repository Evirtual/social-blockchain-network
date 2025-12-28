export type SupportedNetwork = {
  chainId: number;
  name: string;
  description: string;
};

export function getSupportedNetworks(): SupportedNetwork[] {
  // UX requirement: show supported networks as pills with logo + name.
  const networks: SupportedNetwork[] = [
    { chainId: 84532, name: "Base testnet", description: "" },
    { chainId: 11155111, name: "Ethereum testnet", description: "" },
    { chainId: 97, name: "BSC testnet", description: "" }
  ];

  const localAddr = (import.meta.env.VITE_CONTRACT_ADDRESS || "").trim();
  if (localAddr) {
    networks.unshift({ chainId: 31337, name: "Local", description: "" });
  }

  return networks;
}
