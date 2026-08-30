import { useEffect, useMemo, useRef, useState } from "react";
import { getEnv } from "@shared/lib/env";
import { getSubgraphUrlForChainId } from "@shared/lib/subgraph";
import { loadNotificationsFromSubgraph } from "../services/loadNotificationsFromSubgraph";
import { isSocialEventsAvailable, subscribeSocialEvents } from "@shared/lib/socialEvents";
import { createEventRefreshThrottle, isSelfOnlyEvent } from "@shared/lib/eventRefreshThrottle";
import {
  countUnreadNotifications,
  onNotificationsLastSeenChanged,
  readNotificationsLastSeen,
} from "../services/notificationReadState";
import { useContractState } from "@features/contract";
import { filterNotificationsForViewer } from "../lib/notificationFilters";

const EVENT_REFRESH_INTERVAL_MS = 15_000;

export function useNotificationsBadge(args: { walletAddress: string | null; chainId: string | null; first?: number }) {
  const [hasUnread, setHasUnread] = useState(false);  const refreshTimeoutRef = useRef<number | null>(null);
  const { isOwner } = useContractState();

  const env = getEnv();
  const chainIdNum = useMemo(() => {
    const n = Number(args.chainId);
    return Number.isFinite(n) ? n : null;
  }, [args.chainId]);

  const subgraphUrl = useMemo(() => getSubgraphUrlForChainId(env, chainIdNum), [env, chainIdNum]);  useEffect(() => {
    const wallet = String(args.walletAddress ?? "").trim();
    if (!wallet) {
      setHasUnread(false);
      return;
    }

    let cancelled = false;

    const compute = async () => {      const lastSeen = readNotificationsLastSeen(args.chainId, wallet);

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
      const interval = window.setInterval(() => scheduleCompute(), 60_000);
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

    // Same reasoning as useNotifications: cap event-driven refreshes so
    // unrelated network activity cannot drive the request rate.
    const throttle = createEventRefreshThrottle({
      onRefresh: scheduleCompute,
      intervalMs: EVENT_REFRESH_INTERVAL_MS
    });

    const offEvents = subscribeSocialEvents({
      chainIds: [chainIdNum ?? -1],
      onEvent: (event) => {
        if (isSelfOnlyEvent(event, args.walletAddress)) return;
        throttle.request();
      },
      env
    });

    return () => {
      cancelled = true;
      throttle.cancel();
      if (refreshTimeoutRef.current != null) {
        window.clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = null;
      }
      offSeen();
      offEvents();
    };
  }, [args.walletAddress, args.chainId, args.first, subgraphUrl, env, chainIdNum, isOwner]);

  return { hasUnread };
}
