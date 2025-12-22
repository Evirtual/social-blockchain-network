import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import type { TxNotice, TxState } from "../types";

export type TxNotificationsContextValue = {
  txNotices: TxNotice[];
  notifySigning: (label: string) => string;
  notifyPending: (args: { hash: string; label: string; explorerUrl: string | null }) => void;
  notifyConfirmed: (hash: string) => void;
  notifyFailed: (args: { hash?: string; label: string; error: string }) => void;
  notifyCancelled: (label: string) => void;
  dismiss: (hash: string) => void;
};

const TxNotificationsContext = createContext<TxNotificationsContextValue | null>(null);

function makeLocalId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function upsertNotice(prev: TxNotice[], notice: TxNotice) {
  const next = [notice, ...prev.filter((t) => t.hash !== notice.hash)].slice(0, 6);
  return next;
}

function patchNotice(prev: TxNotice[], hash: string, patch: Partial<TxNotice>) {
  return prev.map((t) => (t.hash === hash ? { ...t, ...patch } : t));
}

export function TxNotificationsProvider({ children }: { children: React.ReactNode }) {
  const [txNotices, setTxNotices] = useState<TxNotice[]>([]);
  const dismissTimersRef = useRef<Record<string, number>>({});

  const dismiss = useCallback((hash: string) => {
    const t = dismissTimersRef.current[hash];
    if (typeof t === "number") {
      window.clearTimeout(t);
      delete dismissTimersRef.current[hash];
    }
    setTxNotices((prev) => prev.filter((n) => n.hash !== hash));
  }, []);

  const scheduleAutoDismiss = useCallback(
    (hash: string) => {
      if (dismissTimersRef.current[hash]) return;
      dismissTimersRef.current[hash] = window.setTimeout(() => {
        setTxNotices((prev) => prev.filter((n) => n.hash !== hash));
        delete dismissTimersRef.current[hash];
      }, 5000);
    },
    []
  );

  const notifySigning = useCallback((label: string) => {
    // No tx hash yet. Keep visible until replaced/dismissed.
    const id = makeLocalId("signing");
    setTxNotices((prev) =>
      upsertNotice(prev, {
        hash: id,
        label,
        state: "signing",
        createdAt: Date.now(),
        explorerUrl: null
      })
    );
    return id;
  }, []);

  const notifyPending = useCallback(
    (args: { hash: string; label: string; explorerUrl: string | null }) => {
      // Pending stays until resolved (or user manually dismisses).
      const existingTimer = dismissTimersRef.current[args.hash];
      if (typeof existingTimer === "number") {
        window.clearTimeout(existingTimer);
        delete dismissTimersRef.current[args.hash];
      }
      setTxNotices((prev) =>
        upsertNotice(prev, {
          hash: args.hash,
          label: args.label,
          state: "pending",
          createdAt: Date.now(),
          explorerUrl: args.explorerUrl
        })
      );
    },
    []
  );

  const notifyConfirmed = useCallback((hash: string) => {
    setTxNotices((prev) => patchNotice(prev, hash, { state: "confirmed" }));
    scheduleAutoDismiss(hash);
  }, [scheduleAutoDismiss]);

  const notifyFailed = useCallback(
    (args: { hash?: string; label: string; error: string }) => {
      const id = typeof args.hash === "string" ? args.hash : makeLocalId("failed");

      setTxNotices((prev) =>
        upsertNotice(prev, {
          hash: id,
          label: args.label,
          state: "failed",
          createdAt: Date.now(),
          explorerUrl: null,
          error: args.error
        })
      );

      scheduleAutoDismiss(id);
    },
    [scheduleAutoDismiss]
  );

  const notifyCancelled = useCallback((label: string) => {
    const id = makeLocalId("cancelled");
    setTxNotices((prev) =>
      upsertNotice(prev, {
        hash: id,
        label,
        state: "cancelled",
        createdAt: Date.now(),
        explorerUrl: null
      })
    );

    scheduleAutoDismiss(id);
  }, [scheduleAutoDismiss]);

  const value = useMemo<TxNotificationsContextValue>(
    () => ({
      txNotices,
      notifySigning,
      notifyPending,
      notifyConfirmed,
      notifyFailed,
      notifyCancelled,
      dismiss
    }),
    [txNotices, notifySigning, notifyPending, notifyConfirmed, notifyFailed, notifyCancelled, dismiss]
  );

  return <TxNotificationsContext.Provider value={value}>{children}</TxNotificationsContext.Provider>;
}

export function useTxNotifications() {
  const ctx = useContext(TxNotificationsContext);
  if (!ctx) throw new Error("useTxNotifications must be used within TxNotificationsProvider");
  return ctx;
}

export function isUserRejectedTx(error: unknown) {
  const anyErr = error as any;
  return anyErr?.code === 4001 || anyErr?.code === "ACTION_REJECTED";
}

export function formatTxState(state: TxState) {
  if (state === "signing") return "confirm in wallet";
  if (state === "pending") return "in progress";
  if (state === "confirmed") return "confirmed";
  if (state === "cancelled") return "cancelled";
  return "failed";
}
