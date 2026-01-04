import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { ChainLogo } from "@shared/components/ChainLogos";
import { IconSearch } from "@shared/components/icons";
import type { SupportedNetwork } from "../services/supportedNetworks";

type Props = {
  pillText?: string;
  isPillLoading?: boolean;
  isSearchLoading?: boolean;
  isSearchDirty?: boolean;
  searchQuery: string;
  onSearchQueryChange: (next: string) => void;
  onRestoreDraftToApplied?: () => void;
  onSearchSubmit: () => void;
  selectedNetworkChainIds: string[];
  onSelectedNetworkChainIdsChange: (updater: (prev: string[]) => string[]) => void;
  supportedNetworks: SupportedNetwork[];
};

type BrandHueStyle = CSSProperties & { ["--brand-hue"]?: string | number };

export function FeedHeaderControls(props: Props) {
  const metaRef = useRef<HTMLSpanElement | null>(null);
  const submitRef = useRef<HTMLButtonElement | null>(null);
  const [metaWidthPx, setMetaWidthPx] = useState(0);

  const pillText = (props.pillText ?? "").trim();
  const isSearchLoading = Boolean(props.isSearchLoading);
  const isSearchDirty = Boolean(props.isSearchDirty);
  useLayoutEffect(() => {
    const el = metaRef.current;
    if (!el) {
      setMetaWidthPx(0);
      return;
    }

    const update = () => {
      const w = Math.ceil(el.getBoundingClientRect().width);
      setMetaWidthPx((prev) => (prev === w ? prev : w));
    };

    update();

    // Keep it responsive (fonts, window resize, etc.)
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(() => update());
      ro.observe(el);
      return () => ro.disconnect();
    }

    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [pillText, props.isPillLoading, isSearchLoading]);

  const searchStyle = useMemo<React.CSSProperties | undefined>(() => {
    if (metaWidthPx <= 0) return undefined;
    // Base right padding is ~0.625rem. Add: end-adornment width + a small gap.
    return { paddingRight: `calc(0.625rem + ${metaWidthPx}px + 0.75rem)` };
  }, [metaWidthPx]);

  const selectedNetworks = useMemo(() => {
    if (!props.selectedNetworkChainIds.length) return [];
    const selectedSet = new Set(props.selectedNetworkChainIds);
    return props.supportedNetworks.filter((n) => selectedSet.has(String(n.chainId)));
  }, [props.selectedNetworkChainIds, props.supportedNetworks]);

  return (
    <div className="feedHeaderControls">
      <div className="feedSearchWrap">
        <span ref={metaRef} className="feedSearchEnd">
          {pillText ? (
            <span className="feedSearchMeta" aria-hidden="true">
              {pillText}
            </span>
          ) : props.isPillLoading ? (
            <span className="feedSearchMeta" aria-hidden="true">
              <span className="skeletonLine" style={{ width: "2.1rem", height: "0.7rem" }} />
            </span>
          ) : null}

          <button
            type="button"
            className={isSearchDirty ? "feedSearchSubmit primary" : "feedSearchSubmit"}
            onClick={props.onSearchSubmit}
            aria-label="Search"
            title="Search"
            ref={submitRef}
          >
            {isSearchLoading ? <span className="spinner" aria-hidden="true" /> : <IconSearch size={18} />}
          </button>
        </span>

        <input
          className="input feedSearch"
          type="search"
          name="feedSearch"
          value={props.searchQuery}
          onChange={(e) => props.onSearchQueryChange(e.target.value)}
          onBlur={(e) => {
            const nextFocus = e.relatedTarget as Node | null;
            if (nextFocus && submitRef.current && submitRef.current.contains(nextFocus)) return;

            const trimmedDraft = (props.searchQuery ?? "").trim();
            // If the user cleared the input but didn't submit, keep showing the active search.
            if (!trimmedDraft && props.onRestoreDraftToApplied) props.onRestoreDraftToApplied();
          }}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            props.onSearchSubmit();
          }}
          placeholder="Search"
          aria-label="Search"
          style={searchStyle}
        />
      </div>

      <div className="feedHeaderFilterCluster">
        <details className="feedNetworkFilter">
          <summary className="input feedNetworkFilterSummary" aria-label="Filter networks">
            <span className="feedNetworkFilterSummaryLabel">Networks</span>
            {selectedNetworks.length ? (
              <span className="feedNetworkFilterSummaryIcons" aria-label={`${selectedNetworks.length} selected networks`}>
                {selectedNetworks.map((n) => {
                  const brandStyle: BrandHueStyle = { ["--brand-hue"]: n.brandHue };
                  return (
                    <span
                      key={n.chainId}
                      className="chainBrandMark"
                      style={brandStyle}
                      aria-hidden="true"
                    >
                      <ChainLogo chainId={n.chainId} size={20} />
                    </span>
                  );
                })}
              </span>
            ) : null}
          </summary>
          <div className="feedNetworkFilterMenu" role="group" aria-label="Network filters">
            {props.supportedNetworks.map((n) => {
              const value = String(n.chainId);
              const checked = props.selectedNetworkChainIds.includes(value);
              const brandStyle: BrandHueStyle = { ["--brand-hue"]: n.brandHue };
              return (
                <label key={value} className="feedNetworkFilterOption">
                  <input
                    type="checkbox"
                    name="feedNetworkFilters"
                    checked={checked}
                    onChange={(e) => {
                      props.onSelectedNetworkChainIdsChange((prev) => {
                        if (e.target.checked) return Array.from(new Set([...prev, value]));
                        return prev.filter((x) => x !== value);
                      });
                    }}
                  />
                  <span className="feedNetworkFilterOptionLabel">
                    <span className="chainBrandMark" style={brandStyle} aria-hidden="true">
                      <ChainLogo chainId={n.chainId} size={20} />
                    </span>
                    <span className="feedNetworkFilterOptionText">
                      <span className="feedNetworkFilterOptionPrimary">{n.chainName}</span>
                      {n.networkName ? (
                        <span className="feedNetworkFilterOptionSecondary">{n.networkName}</span>
                      ) : null}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </details>
      </div>
    </div>
  );
}
