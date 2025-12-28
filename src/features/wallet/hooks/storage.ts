export const WALLET_DISCONNECTED_KEY = "socialBlockchainNetwork.walletDisconnected";

export function readWalletAutoConnectDisabled(): boolean {
  try {
    return localStorage.getItem(WALLET_DISCONNECTED_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeWalletAutoConnectDisabled(disabled: boolean) {
  try {
    localStorage.setItem(WALLET_DISCONNECTED_KEY, disabled ? "1" : "0");
  } catch {
    // ignore
  }
}
