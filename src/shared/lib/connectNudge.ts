export const CONNECT_NUDGE_EVENT_NAME = "social-blockchain-network:connect-nudge";

export function requestConnectNudge(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(CONNECT_NUDGE_EVENT_NAME));
}
