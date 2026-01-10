export const WALLET_DISCONNECTED_KEY = "socialBlockchainNetwork.walletDisconnected";

export function writeWalletAutoConnectDisabled(disabled: boolean) {
  if (typeof window === "undefined") return;
  try {
    if (disabled) {
      window.localStorage.setItem(WALLET_DISCONNECTED_KEY, "true");
    } else {
      window.localStorage.removeItem(WALLET_DISCONNECTED_KEY);
    }
  } catch {
    // ignore
  }
}
