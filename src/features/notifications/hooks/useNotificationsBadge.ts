import { useEffect, useMemo, useState } from "react";
import { getEnv, getEnvBoolean } from "@shared/lib/env";
import { getSubgraphUrlForChainId } from "@shared/lib/subgraph";
import { loadNotificationsFromSubgraph } from "../services/loadNotificationsFromSubgraph";
import { buildDemoNotifications } from "../services/demo/demoNotifications";
import { areSubgraphQueriesEnabled, onSubgraphQueriesEnabledChanged } from "@shared/lib/subgraphGate";
import {
  countUnreadNotifications,
  onNotificationsLastSeenChanged,
  readNotificationsLastSeen,
  seedDemoUnreadOncePerLoad
} from "../services/notificationReadState";

export function useNotificationsBadge(args: { walletAddress: string | null; chainId: string | null; first?: number }) {
  const [hasUnread, setHasUnread] = useState(false);
  const [gateEpoch, setGateEpoch] = useState(0);

  const env = getEnv();
  const demoModeEnabled = getEnvBoolean(env, "VITE_DEMO_MODE", false);

  const chainIdNum = useMemo(() => {
    const n = Number(args.chainId);
    return Number.isFinite(n) ? n : null;
  }, [args.chainId]);

  const subgraphUrl = useMemo(() => getSubgraphUrlForChainId(env, chainIdNum), [env, chainIdNum]);

  useEffect(() => {
    if (!demoModeEnabled) return;
    return onSubgraphQueriesEnabledChanged(() => setGateEpoch((n) => n + 1));
  }, [demoModeEnabled]);

  useEffect(() => {
    const wallet = String(args.walletAddress ?? "").trim();
    if (!wallet) {
      setHasUnread(false);
      return;
    }

    let cancelled = false;

    const compute = async () => {
      // Demo mode: show demo notifications + unread dot until marked seen.
      if (demoModeEnabled && !areSubgraphQueriesEnabled(env)) {
        seedDemoUnreadOncePerLoad(args.chainId, wallet);
        const lastSeen = readNotificationsLastSeen(args.chainId, wallet);
        const demoItems = buildDemoNotifications(wallet, args.chainId);
        const unread = countUnreadNotifications(demoItems, lastSeen);
        if (!cancelled) setHasUnread(unread > 0);
        return;
      }

      const lastSeen = readNotificationsLastSeen(args.chainId, wallet);

      if (!subgraphUrl) {
        if (!cancelled) setHasUnread(false);
        return;
      }

      try {
        const res = await loadNotificationsFromSubgraph({
          url: subgraphUrl,
          recipient: wallet,
          first: args.first
        });
        if (cancelled) return;
        const unread = countUnreadNotifications(res.items, lastSeen);
        setHasUnread(unread > 0);
      } catch {
        if (!cancelled) setHasUnread(false);
      }
    };

    void compute();

    // Recompute periodically and when lastSeen changes.
    const interval = window.setInterval(() => void compute(), 20_000);
    const off = onNotificationsLastSeenChanged(() => void compute());

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      off();
    };
  }, [args.walletAddress, args.chainId, args.first, demoModeEnabled, subgraphUrl, env, gateEpoch]);

  return { hasUnread };
}
