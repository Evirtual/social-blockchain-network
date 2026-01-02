import type { TxNotice, TxState } from "@types";
export { makeLocalId } from "@shared/lib/ids";

export function upsertNotice(prev: TxNotice[], notice: TxNotice) {
  const next = [notice, ...prev.filter((t) => t.hash !== notice.hash)].slice(0, 6);
  return next;
}

export function patchNotice(prev: TxNotice[], hash: string, patch: Partial<TxNotice>) {
  return prev.map((t) => (t.hash === hash ? { ...t, ...patch } : t));
}

export type TxErrorInput = Error | { code?: string | number } | string | null | undefined;

export function isUserRejectedTx(error: TxErrorInput) {
  const err = error && typeof error === "object" ? (error as { code?: string | number }) : null;
  return err?.code === 4001 || err?.code === "ACTION_REJECTED";
}

export function formatTxState(state: TxState) {
  if (state === "signing") return "confirm in wallet";
  if (state === "pending") return "in progress";
  if (state === "confirmed") return "confirmed";
  if (state === "cancelled") return "cancelled";
  return "failed";
}
