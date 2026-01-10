export const WALLET_DISCONNECTED_KEY = "socialBlockchainNetwork.walletDisconnected";

export function readWalletAutoConnectDisabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(WALLET_DISCONNECTED_KEY) === "true";
  } catch {
    return false;
  }
}

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
