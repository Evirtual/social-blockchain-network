export const WALLET_DISCONNECTED_KEY = "socialBlockchainNetwork.walletDisconnected";

let walletAutoConnectDisabled = false;

export function readWalletAutoConnectDisabled(): boolean {
  if (typeof window === "undefined") return walletAutoConnectDisabled;
  try {
    const raw = window.localStorage.getItem(WALLET_DISCONNECTED_KEY);
    if (raw == null) return walletAutoConnectDisabled;
    const s = String(raw).trim().toLowerCase();
    if (s === "true") return true;
    if (s === "false") return false;
    return walletAutoConnectDisabled;
  } catch {
    return walletAutoConnectDisabled;
  }
}

export function writeWalletAutoConnectDisabled(disabled: boolean) {
  walletAutoConnectDisabled = disabled;
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
