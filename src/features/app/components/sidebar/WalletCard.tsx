import { formatEther } from "ethers";
import { useEffect, useState } from "react";

import { useIsMobile } from "@features/app/hooks/useIsMobile";
import { Modal } from "@shared/components/Modal";
import { IconChevronDown, IconCoin, IconQuestion } from "@shared/components/icons";

export type WalletCardProps = {
  walletAddress: string | null;
  chainId: string | null;
  networkName: string | null;
  nativeBalance: string;
  withdrawableTipsWei: bigint;
  withdrawFeeBps: number;
  contractAddress: string | undefined;
  contractDeployed: boolean | null;
  status: string;
  onWithdrawTips: () => void;
  isWithdrawSubmitting: boolean;
  shortAddress: (address: string) => string;
  getNativeSymbol: (chainId: string | null) => string;
};

export function WalletCard(props: WalletCardProps) {
  const isMobile = useIsMobile();
  const [isOpen, setIsOpen] = useState<boolean>(() => !isMobile);
  const [isWithdrawInfoOpen, setIsWithdrawInfoOpen] = useState(false);
  const isBalanceLoading = props.nativeBalance === "?";
  const isTipsLoading = props.contractDeployed === null && !!props.walletAddress;

  const withdrawFeeWei = (props.withdrawableTipsWei * BigInt(props.withdrawFeeBps)) / 10_000n;
  const withdrawNetWei = props.withdrawableTipsWei - withdrawFeeWei;
  const balanceSkeleton = (
    <span
      className="skeletonLine"
      style={{ width: "2.1rem", height: "0.85rem", display: "inline-block" }}
      aria-hidden="true"
    />
  );

  const formatEtherTrim = (wei: bigint, maxDecimals: number) => {
    const raw = formatEther(wei);
    const [intPart, fracRaw = ""] = raw.split(".");
    const fracClamped = maxDecimals >= 0 ? fracRaw.slice(0, maxDecimals) : fracRaw;
    const fracTrimmed = fracClamped.replace(/0+$/, "");
    return fracTrimmed ? `${intPart}.${fracTrimmed}` : intPart;
  };

  const formatBpsPercent = (bps: number) => {
    const safeBps = Number.isFinite(bps) && bps > 0 ? Math.floor(bps) : 0;
    const whole = Math.floor(safeBps / 100);
    const frac = safeBps % 100;
    if (!frac) return `${whole}%`;
    const frac2 = String(frac).padStart(2, "0").replace(/0+$/, "");
    return `${whole}.${frac2}%`;
  };

  useEffect(() => {
    // Mobile: collapsed by default. Desktop: expanded by default.
    setIsOpen(!isMobile);
  }, [isMobile]);

  return (
    <details
      className="card cardDropdown walletDropdown"
      open={isOpen}
      onToggle={(e) => setIsOpen((e.currentTarget as HTMLDetailsElement).open)}
    >
      <summary className="cardDropdownSummary">
        <span className="cardTitle">Wallet</span>
        <span className="cardDropdownMeta">{props.walletAddress ? props.shortAddress(props.walletAddress) : "Disconnected"}</span>
        <span className="cardDropdownChevron" aria-hidden="true">
          <IconChevronDown size={18} />
        </span>
      </summary>

      <div className="cardDropdownBody">
        <div className="cardHeader">
          <div className="cardTitle">Wallet</div>
        </div>

        <div className="walletRows">
          <div className="walletRow">
            <div className="walletField">
              <div className="label">Address</div>
              <div className="value">{props.walletAddress ? props.shortAddress(props.walletAddress) : "?"}</div>
            </div>
            <div className="walletField">
              <div className="label">Network</div>
              <div className="value">
                {props.networkName ? `${props.networkName} (${props.chainId})` : props.chainId ? props.chainId : "?"}
              </div>
            </div>
          </div>

          <div className="walletRow">
            <div className="walletField">
              <div className="label">Balance</div>
              <div className="value">
                {isBalanceLoading ? balanceSkeleton : props.nativeBalance} {props.getNativeSymbol(props.chainId)}
              </div>
            </div>
            <div className="walletField">
              <div className="label">Tips</div>
              <div className="value">
                {isTipsLoading ? balanceSkeleton : formatEtherTrim(props.withdrawableTipsWei, 4)} {props.getNativeSymbol(props.chainId)}
              </div>
            </div>
          </div>

          <div className="walletRow walletContractRow">
            <div className="walletField">
              <div className="label">Contract</div>
              <div className="value">
                {props.contractAddress ? props.shortAddress(String(props.contractAddress)) : "?"}
                {props.contractDeployed === false ? " (not on this chain)" : ""}
              </div>
            </div>

            <div className="walletContractActions">
              <button
                type="button"
                className="ghost iconButton"
                aria-label="Withdraw fee details"
                onClick={() => setIsWithdrawInfoOpen(true)}
              >
                <IconQuestion size={20} />
              </button>

              <button
                className="btn primary buttonWithSpinner"
                type="button"
                onClick={props.onWithdrawTips}
                disabled={!props.walletAddress || props.withdrawableTipsWei === 0n || props.isWithdrawSubmitting}
                aria-busy={props.isWithdrawSubmitting}
              >
                {props.isWithdrawSubmitting ? <span className="spinner" aria-hidden="true" /> : <IconCoin size={16} />}
                Withdraw
              </button>
            </div>
          </div>
        </div>

        <Modal open={isWithdrawInfoOpen} title="Withdraw tips" onClose={() => setIsWithdrawInfoOpen(false)}>
          <div className="list">
            <div className="muted">
              A protocol fee is charged when you withdraw. The fee goes to the protocol treasury, and the rest is sent to
              your wallet.
            </div>

            <div className="listRow" role="group" aria-label="Withdrawal estimate">
              <div className="listRowLeft">
                <div>
                  <div className="label">Available tips</div>
                  <div className="value">
                    {isTipsLoading ? "…" : formatEtherTrim(props.withdrawableTipsWei, 6)} {props.getNativeSymbol(props.chainId)}
                  </div>
                </div>
              </div>
              <div className="listRowRight">
                <div style={{ textAlign: "right" }}>
                  <div className="label">Fee ({formatBpsPercent(props.withdrawFeeBps)})</div>
                  <div className="value">
                    {isTipsLoading ? "…" : formatEtherTrim(withdrawFeeWei, 6)} {props.getNativeSymbol(props.chainId)}
                  </div>
                </div>
              </div>
            </div>

            <div className="listRow" role="group" aria-label="Net to wallet">
              <div className="listRowLeft">
                <div>
                  <div className="label">You receive</div>
                  <div className="value">
                    {isTipsLoading ? "…" : formatEtherTrim(withdrawNetWei, 6)} {props.getNativeSymbol(props.chainId)}
                  </div>
                </div>
              </div>
              <div className="listRowRight">
                <button
                  className="btn primary"
                  type="button"
                  onClick={() => {
                    setIsWithdrawInfoOpen(false);
                    props.onWithdrawTips();
                  }}
                  disabled={!props.walletAddress || props.withdrawableTipsWei === 0n || props.isWithdrawSubmitting}
                >
                  Withdraw
                </button>
              </div>
            </div>
          </div>
        </Modal>
      </div>
    </details>
  );
}
