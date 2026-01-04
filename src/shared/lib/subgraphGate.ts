import type { EnvMap } from "./env";
import { getEnvBoolean } from "./env";

let runtimeEnabled: boolean | null = null;

/**
 * FeedProvider should call this whenever approval/live-mode changes.
 *
 * In demo mode we want to block all subgraph HTTP calls until the wallet is approved.
 * In non-demo mode we allow subgraph calls regardless of this flag.
 */
export function setSubgraphQueriesEnabled(enabled: boolean) {
  runtimeEnabled = Boolean(enabled);
}

export function areSubgraphQueriesEnabled(env: EnvMap): boolean {
  const demoModeEnabled = getEnvBoolean(env, "VITE_DEMO_MODE", false);
  if (!demoModeEnabled) return true;
  return runtimeEnabled === true;
}
