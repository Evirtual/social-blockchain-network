import { formatEther } from "ethers";
import { useEffect, useState } from "react";

import { useIsMobile } from "@features/app/hooks/useIsMobile";
import { IconChevronDown, IconCoin } from "@shared/components/icons";

export type WalletCardProps = {
  walletAddress: string | null;
  chainId: string | null;
  networkName: string | null;
  nativeBalance: string;
  withdrawableTipsWei: bigint;
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
  const isBalanceLoading = props.nativeBalance === "?";
  const isTipsLoading = props.contractDeployed === null && !!props.walletAddress;
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
                className="btn primary cardActionButton buttonWithSpinner"
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
      </div>
    </details>
  );
}
