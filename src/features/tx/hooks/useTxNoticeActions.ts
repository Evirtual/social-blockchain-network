import { useCallback } from "react";
import type { TxNotice } from "@types";
import { makeLocalId, patchNotice, upsertNotice } from "./utils";

export function useTxNoticeActions(args: {
  setTxNotices: React.Dispatch<React.SetStateAction<TxNotice[]>>;
  clearDismissTimer: (hash: string) => void;
  scheduleAutoDismiss: (hash: string) => void;
}) {
  const { setTxNotices, clearDismissTimer, scheduleAutoDismiss } = args;

  const dismiss = useCallback(
    (hash: string) => {
      clearDismissTimer(hash);
      setTxNotices((prev) => prev.filter((n) => n.hash !== hash));
    },
    [clearDismissTimer, setTxNotices]
  );

  const notifySigning = useCallback(
    (label: string) => {
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
    },
    [setTxNotices]
  );

  const notifyPending = useCallback(
    (pending: { hash: string; label: string; explorerUrl: string | null }) => {
      clearDismissTimer(pending.hash);
      setTxNotices((prev) =>
        upsertNotice(prev, {
          hash: pending.hash,
          label: pending.label,
          state: "pending",
          createdAt: Date.now(),
          explorerUrl: pending.explorerUrl
        })
      );
    },
    [clearDismissTimer, setTxNotices]
  );

  const notifyConfirmed = useCallback(
    (hash: string) => {
      setTxNotices((prev) => patchNotice(prev, hash, { state: "confirmed" }));
      scheduleAutoDismiss(hash);
    },
    [scheduleAutoDismiss, setTxNotices]
  );

  const notifyFailed = useCallback(
    (failed: { hash?: string; label: string; error: string }) => {
      const id = typeof failed.hash === "string" ? failed.hash : makeLocalId("failed");

      setTxNotices((prev) =>
        upsertNotice(prev, {
          hash: id,
          label: failed.label,
          state: "failed",
          createdAt: Date.now(),
          explorerUrl: null,
          error: failed.error
        })
      );

      scheduleAutoDismiss(id);
    },
    [scheduleAutoDismiss, setTxNotices]
  );

  const notifyCancelled = useCallback(
    (label: string) => {
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
    },
    [scheduleAutoDismiss, setTxNotices]
  );

  return {
    dismiss,
    notifySigning,
    notifyPending,
    notifyConfirmed,
    notifyFailed,
    notifyCancelled
  };
}
