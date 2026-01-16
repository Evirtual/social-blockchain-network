import { useEffect, useMemo, useRef, useState } from "react";
import { getEnv, getEnvBoolean } from "@shared/lib/env";
import { getSubgraphUrlForChainId } from "@shared/lib/subgraph";
import { loadNotificationsFromSubgraph } from "../services/loadNotificationsFromSubgraph";
import { buildDemoNotifications } from "../services/demo/demoNotifications";
import { areSubgraphQueriesEnabled, onSubgraphQueriesEnabledChanged } from "@shared/lib/subgraphGate";
import { isSocialEventsAvailable, subscribeSocialEvents } from "@shared/lib/socialEvents";
import {
  countUnreadNotifications,
  onNotificationsLastSeenChanged,
  readNotificationsLastSeen,
  seedDemoUnreadOncePerLoad
} from "../services/notificationReadState";
import { useContractState } from "@features/contract";
import { filterNotificationsForViewer } from "../lib/notificationFilters";

export function useNotificationsBadge(args: { walletAddress: string | null; chainId: string | null; first?: number }) {
  const [hasUnread, setHasUnread] = useState(false);
  const [gateEpoch, setGateEpoch] = useState(0);
  const refreshTimeoutRef = useRef<number | null>(null);
  const { isOwner } = useContractState();

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
        const demoItems = filterNotificationsForViewer(buildDemoNotifications(wallet, args.chainId), isOwner);
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
          first: args.first,
          chainIdStr: args.chainId
        });
        if (cancelled) return;
        const filtered = filterNotificationsForViewer(res.items, isOwner);
        const unread = countUnreadNotifications(filtered, lastSeen);
        setHasUnread(unread > 0);
      } catch {
        if (!cancelled) setHasUnread(false);
      }
    };

    void compute();

    const scheduleCompute = () => {
      if (cancelled) return;
      if (refreshTimeoutRef.current != null) return;
      refreshTimeoutRef.current = window.setTimeout(() => {
        refreshTimeoutRef.current = null;
        void compute();
      }, 300);
    };

    const supportsEvents = isSocialEventsAvailable(chainIdNum, env);
    const offSeen = onNotificationsLastSeenChanged(() => scheduleCompute());

    if (!supportsEvents) {
      const interval = window.setInterval(() => scheduleCompute(), 120_000);
      return () => {
        cancelled = true;
        if (refreshTimeoutRef.current != null) {
          window.clearTimeout(refreshTimeoutRef.current);
          refreshTimeoutRef.current = null;
        }
        window.clearInterval(interval);
        offSeen();
      };
    }

    const offEvents = subscribeSocialEvents({
      chainIds: [chainIdNum ?? -1],
      onEvent: () => scheduleCompute(),
      env
    });

    return () => {
      cancelled = true;
      if (refreshTimeoutRef.current != null) {
        window.clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = null;
      }
      offSeen();
      offEvents();
    };
  }, [args.walletAddress, args.chainId, args.first, demoModeEnabled, subgraphUrl, env, gateEpoch, chainIdNum, isOwner]);

  return { hasUnread };
}
