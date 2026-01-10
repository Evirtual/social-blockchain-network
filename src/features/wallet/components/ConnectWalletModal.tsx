import type { ReactNode } from "react";
import { Modal } from "@shared/components/Modal";

export type WalletConnectorOption = {
  id: string;
  name: string;
  description?: string;
  badge?: string;
  badgeTone?: "default" | "installed" | "unavailable";
  icon?: ReactNode;
  disabled?: boolean;
};

type Props = {
  open: boolean;
  isBusy: boolean;
  error?: string | null;
  options: WalletConnectorOption[];
  onSelect: (id: string) => void;
  onClose: () => void;
};

export function ConnectWalletModal({ open, isBusy, error, options, onSelect, onClose }: Props) {
  return (
    <Modal open={open} title="Connect Wallet" onClose={onClose}>
      <div className="walletConnectModal">
        {error ? <div className="walletConnectError">{error}</div> : null}
        <div className="walletConnectList">
          {options.map((option) => (
            <button
              key={option.id}
              className="walletConnectItem"
              type="button"
              onClick={() => onSelect(option.id)}
              disabled={isBusy || option.disabled}
            >
              <div className="walletConnectIcon" aria-hidden="true">
                {option.icon ?? option.name.slice(0, 1)}
              </div>
              <div className="walletConnectMeta">
                <div className="walletConnectName">{option.name}</div>
                {option.description ? <div className="walletConnectDescription">{option.description}</div> : null}
              </div>
              {option.badge ? (
                <span
                  className={[
                    "walletConnectBadge",
                    option.badgeTone === "installed"
                      ? "is-installed"
                      : option.badgeTone === "unavailable"
                        ? "is-unavailable"
                        : ""
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {option.badge}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}
