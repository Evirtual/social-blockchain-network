import type { ReactNode } from "react";
import { Link } from "react-router-dom";

type Props = {
  theme: "light" | "dark";
  onToggleTheme: () => void;
  walletAddress: string | null;
  onConnectWallet: () => void;
  onOpenComposer: () => void;
  rightSlot?: ReactNode;
};

export function Topbar({ theme, onToggleTheme, walletAddress, onConnectWallet, onOpenComposer, rightSlot }: Props) {
  return (
    <header className="topbar">
      <Link className="brand" to="/">
        <div className="brand-mark" />
        <div>
          <div className="brand-name">Social Blockchain Network</div>
          <div className="brand-sub">Posts are NFTs. Reactions are signatures.</div>
        </div>
      </Link>
      <div className="topbar-actions">
        <button className="primary iconButton" type="button" onClick={onOpenComposer} aria-label="Create post">
          +
        </button>
        <button className="ghost" type="button" onClick={onToggleTheme}>
          {theme === "dark" ? "Light" : "Dark"}
        </button>
        {walletAddress ? (
          rightSlot ?? null
        ) : (
          <button className="primary" onClick={onConnectWallet}>
            Connect
          </button>
        )}
      </div>
    </header>
  );
}
