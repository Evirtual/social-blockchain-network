import type { EnvMap } from "./env";
import { getEnvBoolean } from "./env";

let runtimeEnabled: boolean | null = null;

const EVENT_NAME = "sbn:subgraphQueriesEnabled";

/**
 * FeedProvider should call this whenever approval/live-mode changes.
 *
 * In demo mode we want to block all subgraph HTTP calls until the wallet is approved.
 * In non-demo mode we allow subgraph calls regardless of this flag.
 */
export function setSubgraphQueriesEnabled(enabled: boolean) {
  const next = Boolean(enabled);
  const prev = runtimeEnabled;
  runtimeEnabled = next;
  if (prev !== next) {
    try {
      window.dispatchEvent(new Event(EVENT_NAME));
    } catch {
      // ignore
    }
  }
}

export function onSubgraphQueriesEnabledChanged(handler: () => void): () => void {
  const h = () => handler();
  window.addEventListener(EVENT_NAME, h);
  return () => window.removeEventListener(EVENT_NAME, h);
}

export function areSubgraphQueriesEnabled(env: EnvMap): boolean {
  const demoModeEnabled = getEnvBoolean(env, "VITE_DEMO_MODE", false);
  if (!demoModeEnabled) return true;
  return runtimeEnabled === true;
}
