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

function isUserRejection(error: unknown) {
  const err = error as { code?: unknown; data?: { originalError?: { code?: unknown } } };
  return err?.code === 4001 || err?.data?.originalError?.code === 4001;
}

/**
 * The outcome of a switch request, carrying why it failed.
 *
 * A bare false left callers with nothing to show, so a rejected or failed
 * switch looked identical to nothing having happened: the dialog kept the old
 * network selected and said nothing.
 */
export type NetworkSwitchResult = {
  ok: boolean;
  error?: string;
};

const REJECTED = "Network switch cancelled in wallet.";
const NO_WALLET = "Connect a wallet to switch networks.";
const FAILED = "Could not switch network. Try switching it in your wallet.";

export async function requestNetworkSwitch(
  targetChainId: number,
  currentChainId?: string | null,
  addChainParameter?: AddEthereumChainParameter | null
): Promise<NetworkSwitchResult> {
  const eth = window.ethereum as EthereumLike | undefined;
  if (!eth?.request) return { ok: false, error: NO_WALLET };
  if (currentChainId && currentChainId === String(targetChainId)) return { ok: true };

  const switchParams = [{ chainId: `0x${targetChainId.toString(16)}` }];

  try {
    await eth.request({
      method: "wallet_switchEthereumChain",
      params: switchParams
    });
    return { ok: true };
  } catch (error) {
    if (isUserRejection(error)) return { ok: false, error: REJECTED };

    // 4902 means the wallet does not know this chain yet, which is worth
    // recovering from by offering to add it. Anything else is a real failure.
    if (!addChainParameter || !isUnknownChainError(error)) return { ok: false, error: FAILED };

    try {
      await eth.request({
        method: "wallet_addEthereumChain",
        params: [addChainParameter]
      });

      await eth.request({
        method: "wallet_switchEthereumChain",
        params: switchParams
      });
      return { ok: true };
    } catch (addError) {
      return { ok: false, error: isUserRejection(addError) ? REJECTED : FAILED };
    }
  }
}

export function formatAddEthereumChainId(chainId: number) {
  return `0x${chainId.toString(16)}`;
}
