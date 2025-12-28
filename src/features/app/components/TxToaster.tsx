import { formatTxState, useTxNotifications } from "../providers/TxNotificationsContext";
import { IconX } from "./icons";

export function TxToaster() {
  const { txNotices, dismiss } = useTxNotifications();

  if (txNotices.length === 0) return null;

  return (
    <div className="txToasts" aria-live="polite" aria-relevant="additions text">
      {txNotices.slice(0, 4).map((tx) => {
        const displayHash = typeof tx.hash === "string" && tx.hash.startsWith("0x");

        return (
          <div key={tx.hash} className={`txToast txToast--${tx.state}`}>
            <div className="txToastRow">
              <span className={`tx-state tx-${tx.state}`}>{formatTxState(tx.state)}</span>
              <span className="txToastLabel">{tx.label}</span>
              <span className="txToastRight">
                {tx.explorerUrl && displayHash ? (
                  <a className="tx-link" href={tx.explorerUrl} target="_blank" rel="noreferrer">
                    {tx.hash.slice(0, 6)}…{tx.hash.slice(-4)}
                  </a>
                ) : null}
                {tx.state === "pending" ? (
                  <button
                    type="button"
                    className="ghost iconButton txToastClose"
                    aria-label="Dismiss"
                    onClick={() => dismiss(tx.hash)}
                  >
                    <IconX size={16} />
                  </button>
                ) : null}
              </span>
            </div>
            {tx.error ? <div className="txToastError">{tx.error}</div> : null}
          </div>
        );
      })}
    </div>
  );
}
