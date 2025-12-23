import { useCallback } from "react";
import { ethers } from "ethers";
import { getExplorerTxUrl } from "../lib/chain";
import { getErrorMessage } from "../lib/errors";
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
      send: () => Promise<ethers.TransactionResponse>,
      onReceipt?: (receipt: ethers.TransactionReceipt) => Promise<T> | T
    ): Promise<T | undefined> {
      let signingToastId: string | null = null;
      try {
        await contract.ensureContractDeployedOnCurrentNetwork();
        setStatus(`${label} (confirm in wallet)...`);

        // Show a toast immediately so the user knows they must confirm in their wallet.
        signingToastId = txNotifications.notifySigning(label);

        const tx = await send();

        if (signingToastId) {
          txNotifications.dismiss(signingToastId);
          signingToastId = null;
        }

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
        if (signingToastId) {
          txNotifications.dismiss(signingToastId);
          signingToastId = null;
        }

        const message = getErrorMessage(error);
        setStatus(message);

        if (isUserRejectedTx(error)) {
          txNotifications.notifyCancelled(label);
        }

        const hash = (error as any)?.transaction?.hash ?? (error as any)?.hash;
        if (typeof hash === "string") {
          txNotifications.notifyFailed({ hash, label, error: message });
        } else if (!isUserRejectedTx(error)) {
          txNotifications.notifyFailed({ label, error: message });
        }

        throw error;
      }
    },
    [contract.ensureContractDeployedOnCurrentNetwork, setStatus, txNotifications, wallet.chainId]
  );

  return { runContractTx };
}
