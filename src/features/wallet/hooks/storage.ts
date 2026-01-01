export const WALLET_DISCONNECTED_KEY = "socialBlockchainNetwork.walletDisconnected";

let walletAutoConnectDisabled = false;

export function readWalletAutoConnectDisabled(): boolean {
  return walletAutoConnectDisabled;
}

export function writeWalletAutoConnectDisabled(disabled: boolean) {
  walletAutoConnectDisabled = disabled;
}
