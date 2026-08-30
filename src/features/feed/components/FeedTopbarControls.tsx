import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Modal } from "@shared/components/Modal";
import { ChainLogo } from "@shared/components/ChainLogos";
import { IconSearch } from "@shared/components/icons";
import { requestNetworkSwitch } from "@shared/lib/networkSwitch";
import { useTopbarOverflow } from "@features/app/components/TopbarOverflowContext";
import { getAddEthereumChainParameter } from "../services/supportedNetworks";
import type { SupportedNetwork } from "../services/supportedNetworks";

type Props = {
  title?: string;
  inlineSlot?: ReactNode;
  showSearch?: boolean;

  pillText?: string;
  isPillLoading?: boolean;

  isSearchLoading?: boolean;
  isSearchDirty?: boolean;
  searchQuery: string;
  onSearchQueryChange: (next: string) => void;
  onRestoreDraftToApplied?: () => void;
  onSearchSubmit: () => void;

  walletAddress: string | null;
  chainId: string | null;

  selectedNetworkChainIds: string[];
  onSelectedNetworkChainIdsChange: (updater: (prev: string[]) => string[]) => void;
  supportedNetworks: SupportedNetwork[];
};

type BrandHueStyle = CSSProperties & { ["--brand-hue"]?: string | number };

export function FeedTopbarControls(props: Props) {
  const { setActions: setOverflowActions, setPanel: setOverflowPanel } = useTopbarOverflow();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isNetworksOpen, setIsNetworksOpen] = useState(false);
  const [networkSwitchError, setNetworkSwitchError] = useState("");
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const showSearch = props.showSearch ?? true;

  const pillText = (props.pillText ?? "").trim();
  const isSearchLoading = Boolean(props.isSearchLoading);
  const hasSearchValue = (props.searchQuery ?? "").trim().length > 0;
  const isConnected = Boolean(props.walletAddress);
  const currentChainId = String(props.chainId ?? "").trim();
  const isWrongNetwork =
    isConnected && (!currentChainId || !props.supportedNetworks.some((n) => String(n.chainId) === currentChainId));

  const selectedNetworks = useMemo(() => {
    if (!props.selectedNetworkChainIds.length) return [];
    const selectedSet = new Set(props.selectedNetworkChainIds.map(String));
    return props.supportedNetworks.filter((n) => selectedSet.has(String(n.chainId)));
  }, [props.selectedNetworkChainIds, props.supportedNetworks]);

  const overflowNetworksIcon = useMemo(() => {
    if (isWrongNetwork) {
      return <span className="topbarFeedWrongNetwork">Wrong network</span>;
    }

    const networksToShow = (selectedNetworks.length ? selectedNetworks : props.supportedNetworks).slice(0, 3);
    return (
      <span className="topbarFeedNetworkIcons" aria-hidden="true">
        {networksToShow.map((n) => {
          const brandStyle: BrandHueStyle = { ["--brand-hue"]: n.brandHue };
          return (
            <span key={n.chainId} className="chainBrandMark" style={brandStyle}>
              <ChainLogo chainId={n.chainId} size={24} />
            </span>
          );
        })}
      </span>
    );
  }, [isWrongNetwork, props.supportedNetworks, selectedNetworks]);

  const overflowSearchIcon = useMemo(
    () => (isSearchLoading ? <span className="spinner" aria-hidden="true" /> : <IconSearch size={18} />),
    [isSearchLoading]
  );

  const overflowActions = useMemo(() => {
    const actions = [];
    if (showSearch) {
      actions.push({
        id: "feed-search",
        label: "Search",
        icon: overflowSearchIcon,
        className: hasSearchValue ? "primary" : "ghost",
        onClick: () => setIsSearchOpen(true)
      });
    }
    actions.push({
      id: "feed-networks",
      label: "Networks",
      icon: overflowNetworksIcon,
      onClick: () => setIsNetworksOpen(true)
    });
    return actions;
  }, [hasSearchValue, overflowNetworksIcon, overflowSearchIcon, showSearch]);

  useEffect(() => {
    setOverflowActions(overflowActions);
    return () => setOverflowActions([]);
  }, [overflowActions, setOverflowActions]);

  useEffect(() => {
    setOverflowPanel(props.inlineSlot ?? null);
    return () => setOverflowPanel(null);
  }, [props.inlineSlot, setOverflowPanel]);

  const handleConnectedNetworkPick = async (chainId: number) => {
    const network = props.supportedNetworks.find((n) => n.chainId === chainId);
    setNetworkSwitchError("");

    const result = await requestNetworkSwitch(
      chainId,
      props.chainId,
      network ? getAddEthereumChainParameter(network) : null
    );

    if (!result.ok) {
      // Keeping the dialog open with the reason on it: closing silently made a
      // rejected switch look like nothing had happened.
      setNetworkSwitchError(result.error ?? "Could not switch network.");
      return;
    }

    props.onSelectedNetworkChainIdsChange(() => [String(chainId)]);
    setIsNetworksOpen(false);
  };

  useEffect(() => {
    if (!isSearchOpen) return;
    searchInputRef.current?.focus();
  }, [isSearchOpen]);

  const allNetworkIds = useMemo(
    () => props.supportedNetworks.map((n) => String(n.chainId)),
    [props.supportedNetworks]
  );

  return (
    <>
      <div className="topbarFeed">
        {props.title ? <div className="topbarFeedTitle">{props.title}</div> : null}
        {props.inlineSlot ? <div className="topbarFeedInline">{props.inlineSlot}</div> : null}

        <div className="topbarFeedControls" role="group" aria-label="Feed controls">
          {showSearch ? (
            <button
              type="button"
              className={`${hasSearchValue ? "primary" : "ghost"} iconButton topbarFeedIcon`}
              onClick={() => setIsSearchOpen(true)}
              aria-label="Search"
              title="Search"
            >
              {isSearchLoading ? <span className="spinner" aria-hidden="true" /> : <IconSearch size={18} />}
            </button>
          ) : null}

          <button
            type="button"
            className={`ghost iconButton topbarFeedNetworks ${isWrongNetwork ? "isWrongNetwork" : ""}`}
            onClick={() => setIsNetworksOpen(true)}
            aria-label={isWrongNetwork ? "Wrong network" : "Networks"}
            title={isWrongNetwork ? "Wrong network" : "Networks"}
          >
            {isWrongNetwork ? (
              <span className="topbarFeedWrongNetwork">Wrong network</span>
            ) : (
              <span className="topbarFeedNetworkIcons" aria-hidden="true">
                {(selectedNetworks.length ? selectedNetworks : props.supportedNetworks).slice(0, 3).map((n) => {
                  const brandStyle: BrandHueStyle = { ["--brand-hue"]: n.brandHue };
                  return (
                    <span key={n.chainId} className="chainBrandMark" style={brandStyle}>
                      <ChainLogo chainId={n.chainId} size={24} />
                    </span>
                  );
                })}
              </span>
            )}
          </button>
        </div>
      </div>

      {showSearch ? (
        <Modal
          open={isSearchOpen}
          title="Search"
          headerTrailing={
            pillText ? (
              <span>{pillText}</span>
            ) : props.isPillLoading ? (
              <span className="skeletonLine" style={{ width: "3.2rem", height: "0.7rem" }} />
            ) : null
          }
          onClose={() => {
            const trimmedDraft = (props.searchQuery ?? "").trim();
            if (!trimmedDraft && props.onRestoreDraftToApplied) props.onRestoreDraftToApplied();
            setIsSearchOpen(false);
          }}
        >
          <div className="feedTopbarSearchModal">
            <div className="feedTopbarSearchRow">
              <div className="feedTopbarSearchField">
                <input
                  className="input feedSearchModalInput feedTopbarSearchInput"
                  type="search"
                  name="feedSearchModal"
                  ref={searchInputRef}
                  value={props.searchQuery}
                  onChange={(e) => props.onSearchQueryChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    e.preventDefault();
                    props.onSearchSubmit();
                    setIsSearchOpen(false);
                  }}
                  placeholder="Search"
                  aria-label="Search"
                />

                <span className="feedSearchEnd" aria-hidden="true">
                  <button
                    type="button"
                    className={`${hasSearchValue ? "primary" : "ghost"} iconButton feedSearchSubmit feedTopbarSearchSubmit`}
                    onClick={() => {
                      props.onSearchSubmit();
                      setIsSearchOpen(false);
                    }}
                    aria-label="Search"
                    title="Search"
                  >
                    {isSearchLoading ? <span className="spinner" aria-hidden="true" /> : <IconSearch size={18} />}
                  </button>
                </span>
              </div>
            </div>
          </div>
        </Modal>
      ) : null}

      <Modal
        open={isNetworksOpen}
        title="Networks"
        onClose={() => {
          setNetworkSwitchError("");
          setIsNetworksOpen(false);
        }}
      >
        <div className="feedNetworksModal">
          <div className="muted">
            {isWrongNetwork
              ? "Wrong network. Select a supported network to switch your wallet before posting or interacting."
              : isConnected
              ? "Showing your connected network by default. Switch networks to change what the feed/search queries."
              : "Select one or more networks to filter the feed."}
          </div>

          {networkSwitchError ? (
            <div className="feedNetworksError" role="alert">
              {networkSwitchError}
            </div>
          ) : null}

          <div className="feedNetworksModalList" role="group" aria-label="Network filters">
            {props.supportedNetworks.map((n) => {
              const value = String(n.chainId);
              const checked = props.selectedNetworkChainIds.includes(value);
              const brandStyle: BrandHueStyle = { ["--brand-hue"]: n.brandHue };

              if (isConnected) {
                return (
                  <button
                    key={value}
                    type="button"
                    className={`feedNetworksModalOption ${checked ? "isActive" : ""}`}
                    onClick={() => void handleConnectedNetworkPick(n.chainId)}
                  >
                    <span className="chainBrandMark" style={brandStyle} aria-hidden="true">
                      <ChainLogo chainId={n.chainId} size={24} />
                    </span>
                    <span className="feedNetworksModalOptionText">
                      <span className="feedNetworksModalOptionPrimary">{n.chainName}</span>
                      {n.networkName ? (
                        <span className="feedNetworksModalOptionSecondary">{n.networkName}</span>
                      ) : null}
                    </span>
                  </button>
                );
              }

              return (
                <label key={value} className="feedNetworksModalOption">
                  <input
                    type="checkbox"
                    name="feedNetworkFilters"
                    checked={checked}
                    onChange={(e) => {
                      props.onSelectedNetworkChainIdsChange((prev) => {
                        if (e.target.checked) return Array.from(new Set([...(prev ?? []), value]));
                        return (prev ?? []).filter((x) => x !== value);
                      });
                    }}
                  />
                  <span className="feedNetworksModalOptionLabel">
                    <span className="chainBrandMark" style={brandStyle} aria-hidden="true">
                      <ChainLogo chainId={n.chainId} size={24} />
                    </span>
                    <span className="feedNetworksModalOptionText">
                      <span className="feedNetworksModalOptionPrimary">{n.chainName}</span>
                      {n.networkName ? (
                        <span className="feedNetworksModalOptionSecondary">{n.networkName}</span>
                      ) : null}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>

          {!isConnected ? (
            <div className="rowActions">
              <button
                type="button"
                className="secondary"
                onClick={() => props.onSelectedNetworkChainIdsChange(() => allNetworkIds)}
              >
                Select all
              </button>
              <button type="button" className="primary" onClick={() => setIsNetworksOpen(false)}>
                Done
              </button>
            </div>
          ) : null}
        </div>
      </Modal>
    </>
  );
}
