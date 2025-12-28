import { useMemo } from "react";
import { BrowserProvider, type Eip1193Provider } from "ethers";

export function useEip1193Provider(providerNonce: number) {
  return useMemo(() => {
    const ethereum = window.ethereum as Eip1193Provider | undefined;
    if (!ethereum) return null;
    return new BrowserProvider(ethereum);
  }, [providerNonce]);
}
