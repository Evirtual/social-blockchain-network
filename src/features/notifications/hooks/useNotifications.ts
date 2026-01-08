import { useEffect, useMemo, useState } from "react";
import type { NotificationItem } from "../types";
import { loadNotificationsFromSubgraph } from "../services/loadNotificationsFromSubgraph";
import { getEnv, getEnvBoolean } from "@shared/lib/env";
import { getSubgraphUrlForChainId } from "@shared/lib/subgraph";
import { buildDemoNotifications } from "../services/demo/demoNotifications";
import { areSubgraphQueriesEnabled, onSubgraphQueriesEnabledChanged } from "@shared/lib/subgraphGate";

export function useNotifications(args: { open: boolean; walletAddress: string | null; chainId: string | null; first?: number }) {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [schemaMismatch, setSchemaMismatch] = useState(false);
  const [error, setError] = useState<string>("");

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
    setItems((prev) => (prev.length ? prev : buildDemoNotifications(args.walletAddress as string, args.chainId)));
  }, [args.open, args.walletAddress, args.chainId, demoModeEnabled, env, gateEpoch]);

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
          setItems(res.items);
        } else {
          setItems((prev) => (prev.length ? prev : buildDemoNotifications(args.walletAddress as string, args.chainId)));
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
  }, [args.open, args.walletAddress, args.chainId, args.first, subgraphUrl, demoModeEnabled, env, gateEpoch]);

  useEffect(() => {
    if (!args.open) return;
    if (!args.walletAddress) return;
    if (!subgraphUrl) return;
    if (schemaMismatch) return;

    if (demoModeEnabled && !areSubgraphQueriesEnabled(env)) return;

    let cancelled = false;
    const intervalMs = 12_000;

    const id = window.setInterval(() => {
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
            setItems(res.items);
          }
        })
        .catch(() => {
          // ignore background refresh errors
        });
    }, intervalMs);

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [args.open, args.walletAddress, args.first, subgraphUrl, schemaMismatch, demoModeEnabled, env, gateEpoch]);

  return { items, loading, schemaMismatch, error, subgraphUrl };
}
