export const COMPOSE_NUDGE_EVENT_NAME = "social-blockchain-network:compose-nudge";

export function requestComposeNudge(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(COMPOSE_NUDGE_EVENT_NAME));
}
