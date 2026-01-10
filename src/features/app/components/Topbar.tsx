import { useRef, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { IconDotsVertical, IconMessage, IconMoon, IconPlus, IconSun } from "@shared/components/icons";
import brandMarkUrl from "@assets/favicon.svg";
import { useTopbarOverflow } from "./TopbarOverflowContext";

type Props = {
  theme: "light" | "dark";
  onToggleTheme: () => void;
  walletAddress: string | null;
  onConnectWallet: () => void;
  onOpenComposer: () => void;
  onOpenNotifications?: () => void;
  hasUnreadNotifications?: boolean;
  centerSlot?: ReactNode;
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
  centerSlot,
  rightSlot,
  connectNudge,
  composeNudge
}: Props) {
  const { actions, panel } = useTopbarOverflow();
  const detailsRef = useRef<HTMLDetailsElement | null>(null);

  const closeOverflowMenu = () => {
    if (detailsRef.current) detailsRef.current.open = false;
  };

  return (
    <header className="topbar">
      <Link className="brand" to="/">
        <img className="brand-mark" src={brandMarkUrl} alt="" />
        <div>
          <div className="brand-name">Social Blockchain Network</div>
          <div className="brand-sub">Posts are NFTs. Reactions are signatures.</div>
        </div>
      </Link>
      <div className="topbar-actions">
        <Link className="topbarLogo" to="/" aria-label="Home">
          <img className="brand-mark" src={brandMarkUrl} alt="" />
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

          {centerSlot ? <div className="topbarCenter">{centerSlot}</div> : null}

          <details className="topbarOverflow" ref={detailsRef}>
            <summary className="ghost iconButton" aria-label="More" title="More">
              <IconDotsVertical size={20} />
            </summary>
            <div className="topbarOverflowMenu" role="menu" aria-label="More actions">
              <div className="topbarOverflowIcons" role="group" aria-label="Quick actions">
                {actions.map((action) => (
                  <button
                    key={action.id}
                    type="button"
                    className={`iconButton topbarOverflowIconButton ${action.className ?? "ghost"}`}
                    role="menuitem"
                    aria-label={action.label}
                    title={action.label}
                    onClick={() => {
                      closeOverflowMenu();
                      action.onClick();
                    }}
                  >
                    {action.icon ?? <span aria-hidden="true">{action.label}</span>}
                  </button>
                ))}

                <button
                  type="button"
                  className={`ghost iconButton topbarOverflowIconButton ${theme === "dark" ? "themeToggleSun" : "themeToggleMoon"}`}
                  role="menuitem"
                  aria-label="Toggle theme"
                  title="Toggle theme"
                  onClick={() => {
                    closeOverflowMenu();
                    onToggleTheme();
                  }}
                >
                  {theme === "dark" ? <IconSun size={18} /> : <IconMoon size={18} />}
                </button>
              </div>

              {panel ? (
                <div className="topbarOverflowPanel" role="group" aria-label="More">
                  <div className="topbarOverflowPanelInner">{panel}</div>
                </div>
              ) : null}
            </div>
          </details>

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
