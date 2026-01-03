import { useCallback } from "react";
import type { TransactionReceipt, TransactionResponse } from "ethers";
import { getExplorerTxUrl } from "@shared/lib/network";
import { getErrorMessage, type ErrorInput } from "@shared/lib/errors";
import { useContractActions } from "../providers/useContractActions";
import { isUserRejectedTx, useTxNotifications } from "@features/tx";
import type { TxErrorInput } from "@features/tx";
import { useStatusActions } from "@features/status";
import { useWalletState } from "@features/wallet";

const RECEIPT_TIMEOUT_MS = 120_000;
const RECEIPT_POLL_INTERVAL_MS = 2_000;

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function waitForReceiptByPolling(params: {
  hash: string;
  timeoutMs: number;
  pollIntervalMs: number;
  getReceipt: () => Promise<TransactionReceipt | null>;
}): Promise<TransactionReceipt | null> {
  const deadline = Date.now() + params.timeoutMs;
  while (Date.now() < deadline) {
    try {
      const receipt = await params.getReceipt();
      if (receipt) return receipt;
    } catch {
      // ignore and keep polling
    }
    await sleep(params.pollIntervalMs);
  }
  return null;
}

export function useContractTx() {
  const txNotifications = useTxNotifications();
  const { setStatus } = useStatusActions();
  const wallet = useWalletState();
  const contract = useContractActions();

  const runContractTx = useCallback(
    async function runContractTx<T>(
      label: string,
      send: () => Promise<TransactionResponse>,
      onReceipt?: (receipt: TransactionReceipt) => Promise<T> | T
    ): Promise<T | undefined> {
      let signingToastId: string | null = null;

      const dismissSigningToast = () => {
        if (!signingToastId) return;
        txNotifications.dismiss(signingToastId);
        signingToastId = null;
      };

      try {
        await contract.ensureContractDeployedOnCurrentNetwork();
        setStatus(`${label} (confirm in wallet)...`);

        // Show a toast immediately so the user knows they must confirm in their wallet.
        signingToastId = txNotifications.notifySigning(label);

        const tx = await send();

        dismissSigningToast();

        const explorerUrl = getExplorerTxUrl(wallet.chainId, tx.hash);
        txNotifications.notifyPending({ hash: tx.hash, label, explorerUrl });

        setStatus(`${label}: pending...`);

        const receipt = wallet.provider
          ? await waitForReceiptByPolling({
              hash: tx.hash,
              timeoutMs: RECEIPT_TIMEOUT_MS,
              pollIntervalMs: RECEIPT_POLL_INTERVAL_MS,
              getReceipt: () => wallet.provider!.getTransactionReceipt(tx.hash)
            })
          : await Promise.race([
              tx.wait(),
              new Promise<TransactionReceipt | null>((resolve) =>
                setTimeout(() => resolve(null), RECEIPT_TIMEOUT_MS)
              )
            ]);

        if (!receipt) {
          setStatus(`${label}: still pending (check explorer).`);
          return undefined;
        }

        txNotifications.notifyConfirmed(tx.hash);
        setStatus(`${label}: confirmed.`);
        if (onReceipt) return await onReceipt(receipt);
        return undefined;
      } catch (error) {
        dismissSigningToast();

        const message = getErrorMessage(error as ErrorInput);
        const rejected = isUserRejectedTx(error as TxErrorInput);
        setStatus(message);

        if (rejected) {
          txNotifications.notifyCancelled(label);
          throw error;
        }

        const err =
          error && typeof error === "object"
            ? (error as { transaction?: { hash?: string }; hash?: string })
            : null;
        const hash = err?.transaction?.hash ?? err?.hash;
        if (typeof hash === "string") {
          txNotifications.notifyFailed({ hash, label, error: message });
        } else {
          txNotifications.notifyFailed({ label, error: message });
        }

        throw error;
      }
    },
    [contract.ensureContractDeployedOnCurrentNetwork, setStatus, txNotifications, wallet.chainId]
  );

  return { runContractTx };
}
