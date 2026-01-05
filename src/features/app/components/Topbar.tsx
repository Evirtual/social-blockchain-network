import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { IconMessage, IconMoon, IconPlus, IconSun } from "@shared/components/icons";

type Props = {
  theme: "light" | "dark";
  onToggleTheme: () => void;
  walletAddress: string | null;
  onConnectWallet: () => void;
  onOpenComposer: () => void;
  onOpenNotifications?: () => void;
  hasUnreadNotifications?: boolean;
  rightSlot?: ReactNode;
  connectNudge?: boolean;
  composeNudge?: boolean;
};

export function Topbar({
  theme,
  onToggleTheme,
  walletAddress,
  onConnectWallet,
  onOpenComposer,
  onOpenNotifications,
  hasUnreadNotifications,
  rightSlot,
  connectNudge,
  composeNudge
}: Props) {
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
          {walletAddress ? (
            <button
              className={`primary iconButton ${composeNudge ? "composeNudge" : ""}`}
              type="button"
              onClick={onOpenComposer}
              aria-label="Create post"
            >
              <IconPlus size={18} />
            </button>
          ) : null}
          {walletAddress ? (
            <>
              {typeof onOpenNotifications === "function" ? (
                <button
                  className={`ghost iconButton ${hasUnreadNotifications ? "hasUnread" : ""}`}
                  type="button"
                  onClick={onOpenNotifications}
                  aria-label="Notifications"
                >
                  <IconMessage size={18} />
                </button>
              ) : null}
              {rightSlot ?? null}
            </>
          ) : (
            <button className={`primary ${connectNudge ? "connectNudge" : ""}`} onClick={onConnectWallet}>
              Connect
            </button>
          )}
          <button
            className={`ghost iconButton themeToggle ${theme === "dark" ? "themeToggleSun" : "themeToggleMoon"}`}
            type="button"
            onClick={onToggleTheme}
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <IconSun size={18} /> : <IconMoon size={18} />}
          </button>
        </div>
      </div>
    </header>
  );
}
