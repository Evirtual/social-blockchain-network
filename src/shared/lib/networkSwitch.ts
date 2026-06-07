export type AddEthereumChainParameter = {
  chainId: string;
  chainName: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  rpcUrls: string[];
  blockExplorerUrls?: string[];
};

type EthereumRequestArgs = {
  method: string;
  params?: Array<{ chainId?: string } | AddEthereumChainParameter>;
};
type EthereumLike = { request?: (args: EthereumRequestArgs) => Promise<null> };

function isUnknownChainError(error: unknown) {
  const err = error as { code?: unknown; data?: { originalError?: { code?: unknown } } };
  return err?.code === 4902 || err?.data?.originalError?.code === 4902;
}

export async function requestNetworkSwitch(
  targetChainId: number,
  currentChainId?: string | null,
  addChainParameter?: AddEthereumChainParameter | null
) {
  const eth = window.ethereum as EthereumLike | undefined;
  if (!eth?.request) return false;
  if (currentChainId && currentChainId === String(targetChainId)) return true;

  const switchParams = [{ chainId: `0x${targetChainId.toString(16)}` }];

  try {
    await eth.request({
      method: "wallet_switchEthereumChain",
      params: switchParams
    });
    return true;
  } catch (error) {
    if (!addChainParameter || !isUnknownChainError(error)) return false;

    try {
      await eth.request({
        method: "wallet_addEthereumChain",
        params: [addChainParameter]
      });

      await eth.request({
        method: "wallet_switchEthereumChain",
        params: switchParams
      });
      return true;
    } catch {
      return false;
    }
  }
}

export function formatAddEthereumChainId(chainId: number) {
  return `0x${chainId.toString(16)}`;
}
