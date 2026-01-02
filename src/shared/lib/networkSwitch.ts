type EthereumRequestArgs = { method: string; params?: Array<{ chainId?: string }> };
type EthereumLike = { request?: (args: EthereumRequestArgs) => Promise<null> };

export async function requestNetworkSwitch(targetChainId: number, currentChainId?: string | null) {
  const eth = window.ethereum as EthereumLike | undefined;
  if (!eth?.request) return false;
  if (currentChainId && currentChainId === String(targetChainId)) return true;

  try {
    await eth.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: `0x${targetChainId.toString(16)}` }]
    });
    return true;
  } catch {
    return false;
  }
}
