import { formatEther } from "ethers";
import { useEffect, useState } from "react";

import { useIsMobile } from "@features/app/hooks/useIsMobile";
import { Modal } from "@shared/components/Modal";
import { IconCheck, IconChevronDown, IconCoin, IconCopy } from "@shared/components/icons";
import { shortAddress } from "@shared/lib/format";
import { getNativeSymbol } from "@shared/lib/chain";

export type WalletCardProps = {
  walletAddress: string | null;
  chainId: string | null;
  networkName: string | null;
  nativeBalance: string;
  withdrawableTipsWei: bigint;
  withdrawFeeBps: number;

  isOwner: boolean;
  protocolTreasuryAddress: string | null;
  treasuryWithdrawableTipsWei: bigint;
  treasuryNativeBalanceWei: bigint;

  contractAddress: string | undefined;
  contractDeployed: boolean | null;
  status: string;
  onWithdrawTips: () => void;
  isWithdrawSubmitting: boolean;
};

export function WalletCard(props: WalletCardProps) {
  const isMobile = useIsMobile();
  const [isOpen, setIsOpen] = useState<boolean>(() => !isMobile);
  const [isWithdrawInfoOpen, setIsWithdrawInfoOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState<"wallet" | "contract" | "treasury" | null>(null);
  const isBalanceLoading = props.nativeBalance === "?";
  const isTipsLoading = props.contractDeployed === null && !!props.walletAddress;

  const isConnectedAsTreasury =
    !!props.walletAddress &&
    !!props.protocolTreasuryAddress &&
    props.walletAddress.toLowerCase() === props.protocolTreasuryAddress.toLowerCase();

  const withdrawLabel = isConnectedAsTreasury ? "Withdraw" : "Withdraw";

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

  const copyText = async (text: string, which: "wallet" | "contract" | "treasury") => {
    const value = String(text ?? "").trim();
    if (!value) return;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else if (typeof document !== "undefined") {
        const ta = document.createElement("textarea");
        ta.value = value;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        ta.style.pointerEvents = "none";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }

      setCopiedKey(which);
      window.setTimeout(() => setCopiedKey((prev) => (prev === which ? null : prev)), 1_200);
    } catch {
      // ignore
    }
  };

  return (
    <details
      className="card cardDropdown walletDropdown"
      open={isOpen}
      onToggle={(e) => setIsOpen((e.currentTarget as HTMLDetailsElement).open)}
    >
      <summary className="cardDropdownSummary">
        <span className="cardTitle">Wallet</span>
        <span className="cardDropdownMeta">{props.walletAddress ? shortAddress(props.walletAddress) : "Disconnected"}</span>
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
              <div className="walletValueWithAction">
                <span className="walletValueText">
                  {props.walletAddress ? shortAddress(props.walletAddress) : "?"}
                </span>
                {props.walletAddress ? (
                  <button
                    type="button"
                    className="ghost iconButton walletCopyButton"
                    aria-label="Copy wallet address"
                    title="Copy wallet address"
                    onClick={() => void copyText(props.walletAddress ?? "", "wallet")}
                  >
                    {copiedKey === "wallet" ? <IconCheck size={14} /> : <IconCopy size={14} />}
                  </button>
                ) : null}
              </div>
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
                {isBalanceLoading ? balanceSkeleton : props.nativeBalance} {getNativeSymbol(props.chainId)}
              </div>
            </div>
            <div className="walletField">
              <div className="label">Tips</div>
              <div className="value">
                {isTipsLoading ? balanceSkeleton : formatEtherTrim(props.withdrawableTipsWei, 4)} {getNativeSymbol(props.chainId)}
              </div>
            </div>
          </div>

          <div className="walletRow walletContractRow">
            <div className="walletField">
              <div className="label">Contract</div>
              <div className="walletValueWithAction">
                <span className="walletValueText">
                  {props.contractAddress ? shortAddress(String(props.contractAddress)) : "?"}
                  {props.contractDeployed === false ? " (not on this chain)" : ""}
                </span>

                {props.contractAddress ? (
                  <button
                    type="button"
                    className="ghost iconButton walletCopyButton"
                    aria-label="Copy contract address"
                    title="Copy contract address"
                    onClick={() => void copyText(String(props.contractAddress ?? ""), "contract")}
                  >
                    {copiedKey === "contract" ? <IconCheck size={14} /> : <IconCopy size={14} />}
                  </button>
                ) : null}
              </div>
            </div>

            <div className="walletContractActions">
              <button
                className="btn primary buttonWithSpinner"
                type="button"
                onClick={() => setIsWithdrawInfoOpen(true)}
                disabled={!props.walletAddress || props.withdrawableTipsWei === 0n || props.isWithdrawSubmitting}
                aria-busy={props.isWithdrawSubmitting}
              >
                {props.isWithdrawSubmitting ? <span className="spinner" aria-hidden="true" /> : <IconCoin size={16} />}
                {withdrawLabel}
              </button>
            </div>
          </div>
        </div>

        <Modal open={isWithdrawInfoOpen} title={withdrawLabel} onClose={() => setIsWithdrawInfoOpen(false)}>
          <div className="list">
            {isConnectedAsTreasury ? (
              <>
                <div className="muted">
                  Withdraws the treasury’s withdrawable tips (protocol support). Withdraw fees from other users are already
                  in the treasury wallet balance.
                </div>

                <div className="listRow" role="group" aria-label="Treasury address">
                  <div className="listRowLeft">
                    <div>
                      <div className="label">Treasury</div>
                      <div className="walletValueWithAction">
                        <span className="walletValueText">
                          {props.protocolTreasuryAddress ? shortAddress(props.protocolTreasuryAddress) : "?"}
                        </span>
                        {props.protocolTreasuryAddress ? (
                          <button
                            type="button"
                            className="ghost iconButton walletCopyButton"
                            aria-label="Copy treasury address"
                            title="Copy treasury address"
                            onClick={() => void copyText(props.protocolTreasuryAddress ?? "", "treasury")}
                          >
                            {copiedKey === "treasury" ? <IconCheck size={14} /> : <IconCopy size={14} />}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <div className="listRowRight" />
                </div>

                <div className="listRow" role="group" aria-label="Treasury wallet balance">
                  <div className="listRowLeft">
                    <div>
                      <div className="label">Treasury wallet balance</div>
                      <div className="value">
                        {isTipsLoading ? "…" : formatEtherTrim(props.treasuryNativeBalanceWei, 6)} {getNativeSymbol(props.chainId)}
                      </div>
                    </div>
                  </div>
                  <div className="listRowRight" />
                </div>

                <div className="listRow" role="group" aria-label="Treasury withdraw estimate">
                  <div className="listRowLeft">
                    <div>
                      <div className="label">Treasury withdrawable</div>
                      <div className="value">
                        {isTipsLoading ? "…" : formatEtherTrim(props.withdrawableTipsWei, 6)} {getNativeSymbol(props.chainId)}
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
                      {withdrawLabel}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="muted">
                  A protocol fee is charged when you withdraw. The fee goes to the protocol treasury, and the rest is sent
                  to your wallet.
                </div>

                <div className="listRow" role="group" aria-label="Withdrawal estimate">
                  <div className="listRowLeft">
                    <div>
                      <div className="label">Available tips</div>
                      <div className="value">
                        {isTipsLoading ? "…" : formatEtherTrim(props.withdrawableTipsWei, 6)} {getNativeSymbol(props.chainId)}
                      </div>
                    </div>
                  </div>
                  <div className="listRowRight">
                    <div style={{ textAlign: "right" }}>
                      <div className="label">Fee ({formatBpsPercent(props.withdrawFeeBps)})</div>
                      <div className="value">
                        {isTipsLoading ? "…" : formatEtherTrim(withdrawFeeWei, 6)} {getNativeSymbol(props.chainId)}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="listRow" role="group" aria-label="Net to wallet">
                  <div className="listRowLeft">
                    <div>
                      <div className="label">You receive</div>
                      <div className="value">
                        {isTipsLoading ? "…" : formatEtherTrim(withdrawNetWei, 6)} {getNativeSymbol(props.chainId)}
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
                      {withdrawLabel}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </Modal>
      </div>
    </details>
  );
}
