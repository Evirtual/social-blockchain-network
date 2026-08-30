import { useEffect, useMemo, useReducer, useRef } from "react";
import { loadNotificationsFromSubgraph } from "../services/loadNotificationsFromSubgraph";
import { getEnv } from "@shared/lib/env";
import { getSubgraphUrlForChainId } from "@shared/lib/subgraph";
import { isSocialEventsAvailable, subscribeSocialEvents } from "@shared/lib/socialEvents";
import { createEventRefreshThrottle, isSelfOnlyEvent } from "@shared/lib/eventRefreshThrottle";
import { useContractState } from "@features/contract";
import { filterNotificationsForViewer } from "../lib/notificationFilters";
import { initialNotificationsState, notificationsReducer } from "../lib/notificationsState";

const EVENT_REFRESH_INTERVAL_MS = 15_000;

export function useNotifications(args: { open: boolean; walletAddress: string | null; chainId: string | null; first?: number }) {
  // One reducer rather than four independent setters: the list, the error and
  // the loading flag can no longer contradict each other.
  const [state, dispatch] = useReducer(notificationsReducer, initialNotificationsState);
  const { items, error, schemaMismatch, isLoading: loading } = state;
  const refreshTimeoutRef = useRef<number | null>(null);
  const { isOwner } = useContractState();

  const env = getEnv();
  const chainIdNum = useMemo(() => {
    const n = Number(args.chainId);
    return Number.isFinite(n) ? n : null;
  }, [args.chainId]);

  const subgraphUrl = useMemo(() => getSubgraphUrlForChainId(env, chainIdNum), [env, chainIdNum]);

  // Notifications belong to one account on one chain. Without clearing, a load
  // that fails after switching would keep the previous account visible.
  const identity = `${args.chainId ?? ""}:${(args.walletAddress ?? "").toLowerCase()}`;
  const lastIdentityRef = useRef(identity);
  useEffect(() => {
    if (lastIdentityRef.current === identity) return;
    lastIdentityRef.current = identity;
    dispatch({ type: "reset" });
  }, [identity]);

  useEffect(() => {
    if (!args.open) return;
    if (!args.walletAddress) return;
    if (!subgraphUrl) return;

    let cancelled = false;
    dispatch({ type: "load-started" });

    loadNotificationsFromSubgraph({
      url: subgraphUrl,
      recipient: args.walletAddress,
      first: args.first,
      chainIdStr: args.chainId
    })
      .then((res) => {
        if (cancelled) return;
        dispatch({
          type: "load-succeeded",
          items: filterNotificationsForViewer(res.items, isOwner),
          schemaMismatch: res.schemaMismatch
        });
      })
      .catch((err) => {
        if (cancelled) return;
        dispatch({
          type: "load-failed",
          message: err instanceof Error ? err.message : String(err ?? "")
        });
      });

    return () => {
      cancelled = true;
    };
  }, [args.open, args.walletAddress, args.chainId, args.first, subgraphUrl, isOwner]);

  useEffect(() => {
    if (!args.open) return;
    if (!args.walletAddress) return;
    if (!subgraphUrl) return;
    if (schemaMismatch) return;


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
            // Applied even when empty: a list that has genuinely been cleared
            // must not keep showing items the previous load happened to find.
            dispatch({
              type: "refresh-succeeded",
              items: filterNotificationsForViewer(res.items, isOwner),
              schemaMismatch: res.schemaMismatch
            });
          })
          .catch(() => {
            if (cancelled) return;
            dispatch({ type: "refresh-failed" });
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
    env,
    chainIdNum,
    isOwner
  ]);

  return { items, loading, schemaMismatch, error, subgraphUrl };
}
