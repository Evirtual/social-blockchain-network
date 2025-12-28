import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { TxNotice } from "@types";
import { formatTxState, isUserRejectedTx, useDismissTimers, useTxNoticeActions } from "../../tx";

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

export function TxNotificationsProvider({ children }: { children: React.ReactNode }) {
  const [txNotices, setTxNotices] = useState<TxNotice[]>([]);

  const onDismiss = useCallback((hash: string) => {
    setTxNotices((prev) => prev.filter((n) => n.hash !== hash));
  }, []);

  const { clearDismissTimer, scheduleAutoDismiss } = useDismissTimers(onDismiss, 5000);

  const { dismiss, notifySigning, notifyPending, notifyConfirmed, notifyFailed, notifyCancelled } = useTxNoticeActions({
    setTxNotices,
    clearDismissTimer,
    scheduleAutoDismiss
  });

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

export { isUserRejectedTx, formatTxState };
