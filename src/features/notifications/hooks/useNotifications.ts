import { useEffect, useMemo, useRef, useState } from "react";
import type { NotificationItem } from "../types";
import { loadNotificationsFromSubgraph } from "../services/loadNotificationsFromSubgraph";
import { getEnv, getEnvBoolean } from "@shared/lib/env";
import { getSubgraphUrlForChainId } from "@shared/lib/subgraph";
import { buildDemoNotifications } from "../services/demo/demoNotifications";
import { areSubgraphQueriesEnabled, onSubgraphQueriesEnabledChanged } from "@shared/lib/subgraphGate";
import { isSocialEventsAvailable, subscribeSocialEvents } from "@shared/lib/socialEvents";
import { createEventRefreshThrottle, isSelfOnlyEvent } from "@shared/lib/eventRefreshThrottle";
import { useContractState } from "@features/contract";
import { filterNotificationsForViewer } from "../lib/notificationFilters";

const EVENT_REFRESH_INTERVAL_MS = 15_000;

export function useNotifications(args: { open: boolean; walletAddress: string | null; chainId: string | null; first?: number }) {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [schemaMismatch, setSchemaMismatch] = useState(false);
  const [error, setError] = useState<string>("");
  const refreshTimeoutRef = useRef<number | null>(null);
  const { isOwner } = useContractState();

  const env = getEnv();
  const chainIdNum = useMemo(() => {
    const n = Number(args.chainId);
    return Number.isFinite(n) ? n : null;
  }, [args.chainId]);

  const subgraphUrl = useMemo(() => getSubgraphUrlForChainId(env, chainIdNum), [env, chainIdNum]);
  const demoModeEnabled = getEnvBoolean(env, "VITE_DEMO_MODE", false);

  const [gateEpoch, setGateEpoch] = useState(0);
  useEffect(() => {
    if (!demoModeEnabled) return;
    return onSubgraphQueriesEnabledChanged(() => setGateEpoch((n) => n + 1));
  }, [demoModeEnabled]);

  useEffect(() => {
    if (!args.open) return;
    if (!demoModeEnabled) return;
    if (!args.walletAddress) return;
    if (areSubgraphQueriesEnabled(env)) return;

    // Demo mode: only seed notifications while the wallet is not approved (live feed disabled).
    const demo = buildDemoNotifications(args.walletAddress as string, args.chainId);
    setItems((prev) => (prev.length ? prev : filterNotificationsForViewer(demo, isOwner)));
  }, [args.open, args.walletAddress, args.chainId, demoModeEnabled, env, gateEpoch, isOwner]);

  useEffect(() => {
    if (!args.open) return;
    if (!args.walletAddress) return;
    if (!subgraphUrl) return;

    // Demo mode: if the wallet isn't approved yet, don't hit the subgraph at all.
    // (subgraph queries are intentionally blocked until approval)
    if (demoModeEnabled && !areSubgraphQueriesEnabled(env)) return;

    let cancelled = false;
    setLoading(true);
    setError("");

    loadNotificationsFromSubgraph({
      url: subgraphUrl,
      recipient: args.walletAddress,
      first: args.first,
      chainIdStr: args.chainId
    })
      .then((res) => {
        if (cancelled) return;
        setSchemaMismatch(res.schemaMismatch);
        const canUseDemoFallback = demoModeEnabled && !areSubgraphQueriesEnabled(env);

        // If we're approved (live), always show the real subgraph result (even if empty).
        if (res.items.length > 0 || !canUseDemoFallback) {
          setItems(filterNotificationsForViewer(res.items, isOwner));
        } else {
          const demo = buildDemoNotifications(args.walletAddress as string, args.chainId);
          setItems((prev) => (prev.length ? prev : filterNotificationsForViewer(demo, isOwner)));
        }
      })
      .catch((err) => {
        if (cancelled) return;
        const canUseDemoFallback = demoModeEnabled && !areSubgraphQueriesEnabled(env);
        setItems((prev) => (canUseDemoFallback && prev.length ? prev : []));
        setSchemaMismatch(false);
        setError(err instanceof Error ? err.message : String(err ?? ""));
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [args.open, args.walletAddress, args.chainId, args.first, subgraphUrl, demoModeEnabled, env, gateEpoch, isOwner]);

  useEffect(() => {
    if (!args.open) return;
    if (!args.walletAddress) return;
    if (!subgraphUrl) return;
    if (schemaMismatch) return;

    if (demoModeEnabled && !areSubgraphQueriesEnabled(env)) return;

    let cancelled = false;
    const scheduleRefresh = () => {
      if (cancelled) return;
      if (refreshTimeoutRef.current != null) return;
      refreshTimeoutRef.current = window.setTimeout(() => {
        refreshTimeoutRef.current = null;
        loadNotificationsFromSubgraph({
          url: subgraphUrl,
          recipient: args.walletAddress as string,
          first: args.first,
          bypassCache: true,
          chainIdStr: args.chainId
        })
          .then((res) => {
            if (cancelled) return;
            setSchemaMismatch(res.schemaMismatch);
            if (res.items.length > 0) {
              setItems(filterNotificationsForViewer(res.items, isOwner));
            }
          })
          .catch(() => {
            // ignore background refresh errors
          });
      }, 400);
    };

    const supportsEvents = isSocialEventsAvailable(chainIdNum, env);
    if (!supportsEvents) {
      const intervalMs = 60_000;
      const id = window.setInterval(() => {
        scheduleRefresh();
      }, intervalMs);
      return () => {
        cancelled = true;
        if (refreshTimeoutRef.current != null) {
          window.clearTimeout(refreshTimeoutRef.current);
          refreshTimeoutRef.current = null;
        }
        window.clearInterval(id);
      };
    }

    // Events arrive for the whole network. Skip the ones that provably cannot
    // notify this user, and cap the rest so a busy chain cannot drive one
    // request per event.
    const throttle = createEventRefreshThrottle({
      onRefresh: scheduleRefresh,
      intervalMs: EVENT_REFRESH_INTERVAL_MS
    });

    const off = subscribeSocialEvents({
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
      off();
    };
  }, [
    args.open,
    args.walletAddress,
    args.chainId,
    args.first,
    subgraphUrl,
    schemaMismatch,
    demoModeEnabled,
    env,
    gateEpoch,
    chainIdNum,
    isOwner
  ]);

  return { items, loading, schemaMismatch, error, subgraphUrl };
}
