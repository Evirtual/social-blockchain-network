import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { IconMoon, IconPlus, IconSun } from "./icons";

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
        <Link className="topbarLogo" to="/" aria-label="Home">
          <div className="brand-mark" />
        </Link>

        <div className="topbarControls">
          <button className="primary iconButton" type="button" onClick={onOpenComposer} aria-label="Create post">
            <IconPlus size={18} />
          </button>
          <button className="ghost iconButton" type="button" onClick={onToggleTheme} aria-label="Toggle theme">
            {theme === "dark" ? <IconSun size={18} /> : <IconMoon size={18} />}
          </button>
          {walletAddress ? (
            rightSlot ?? null
          ) : (
            <button className="primary" onClick={onConnectWallet}>
              Connect
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
