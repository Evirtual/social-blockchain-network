import type { TxNotice, TxState } from "@types";
export { makeLocalId } from "@shared/lib/ids";

export function upsertNotice(prev: TxNotice[], notice: TxNotice) {
  const next = [notice, ...prev.filter((t) => t.hash !== notice.hash)].slice(0, 6);
  return next;
}

export function patchNotice(prev: TxNotice[], hash: string, patch: Partial<TxNotice>) {
  return prev.map((t) => (t.hash === hash ? { ...t, ...patch } : t));
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
