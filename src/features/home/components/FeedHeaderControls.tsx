import type { SupportedNetwork } from "../services/supportedNetworks";

type Props = {
  searchQuery: string;
  onSearchQueryChange: (next: string) => void;
  selectedNetworkChainIds: string[];
  onSelectedNetworkChainIdsChange: (updater: (prev: string[]) => string[]) => void;
  supportedNetworks: SupportedNetwork[];
};

export function FeedHeaderControls(props: Props) {
  return (
    <div className="feedHeaderControls">
      <input
        className="input feedSearch"
        type="search"
        value={props.searchQuery}
        onChange={(e) => props.onSearchQueryChange(e.target.value)}
        placeholder="Search posts or accounts"
        aria-label="Search posts or accounts"
      />

      <details className="feedNetworkFilter">
        <summary className="input feedNetworkFilterSummary" aria-label="Filter networks">
          Networks {props.selectedNetworkChainIds.length ? `(${props.selectedNetworkChainIds.length})` : "(All)"}
        </summary>
        <div className="feedNetworkFilterMenu" role="group" aria-label="Network filters">
          {props.supportedNetworks.map((n) => {
            const value = String(n.chainId);
            const checked = props.selectedNetworkChainIds.includes(value);
            return (
              <label key={value} className="feedNetworkFilterOption">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => {
                    props.onSelectedNetworkChainIdsChange((prev) => {
                      if (e.target.checked) return Array.from(new Set([...prev, value]));
                      return prev.filter((x) => x !== value);
                    });
                  }}
                />
                {n.name}
              </label>
            );
          })}
        </div>
      </details>
    </div>
  );
}
