import { useCallback } from "react";
import type { TransactionReceipt, TransactionResponse } from "ethers";
import { getExplorerTxUrl } from "@shared/lib/chain";
import { getErrorMessage } from "@shared/lib/errors";
import { useContract } from "./ContractContext";
import { isUserRejectedTx, useTxNotifications } from "./TxNotificationsContext";
import { useStatus } from "./StatusContext";
import { useWallet } from "./WalletContext";

export function useContractTx() {
  const txNotifications = useTxNotifications();
  const { setStatus } = useStatus();
  const wallet = useWallet();
  const contract = useContract();

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
        const receipt = await tx.wait();

        if (!receipt) {
          txNotifications.notifyFailed({ hash: tx.hash, label, error: "Transaction receipt unavailable." });
          setStatus("Transaction receipt unavailable.");
          return undefined;
        }

        txNotifications.notifyConfirmed(tx.hash);
        setStatus(`${label}: confirmed.`);
        if (onReceipt) return await onReceipt(receipt);
        return undefined;
      } catch (error) {
        dismissSigningToast();

        const message = getErrorMessage(error);
        const rejected = isUserRejectedTx(error);
        setStatus(message);

        if (rejected) {
          txNotifications.notifyCancelled(label);
          throw error;
        }

        const hash = (error as any)?.transaction?.hash ?? (error as any)?.hash;
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
