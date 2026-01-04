import { useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";

const SCROLL_KEY_PREFIX = "socialBlockchainNetwork.scroll:";

function isPostRoute(pathname: string) {
  return pathname === "/post" || pathname.startsWith("/post/");
}

function isProfileRoute(pathname: string) {
  return pathname === "/profile" || pathname.startsWith("/profile/");
}

function isScrollRestoreRoute(pathname: string) {
  return pathname === "/" || isProfileRoute(pathname);
}

function scrollKeyForLocation(pathname: string, search: string) {
  // Keep it simple: per-pathname is good enough for profile pages (address is in pathname).
  // Include search for Home, since it can be filter-driven.
  const suffix = pathname === "/" ? `${pathname}${search ?? ""}` : pathname;
  return `${SCROLL_KEY_PREFIX}${suffix}`;
}

function readScrollY(key: string): number {
  try {
    const raw = window.sessionStorage.getItem(key);
    const n = raw == null ? 0 : Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

function writeScrollY(key: string, y: number) {
  try {
    window.sessionStorage.setItem(key, String(Math.max(0, Math.floor(y))));
  } catch {
    // ignore
  }
}

export function ScrollToTop() {
  const location = useLocation();

  // Save Home scroll position right before we navigate away.
  useLayoutEffect(() => {
    return () => {
      if (typeof window === "undefined") return;
      if (isScrollRestoreRoute(location.pathname)) {
        const key = scrollKeyForLocation(location.pathname, location.search);
        writeScrollY(key, window.scrollY);
      }
    };
  }, [location.key]);

  // Apply scroll behavior for the next route.
  useLayoutEffect(() => {
    if (typeof window === "undefined") return;

    if (isPostRoute(location.pathname)) {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      return;
    }

    if (isScrollRestoreRoute(location.pathname)) {
      const key = scrollKeyForLocation(location.pathname, location.search);
      const y = readScrollY(key);
      window.scrollTo({ top: y, left: 0, behavior: "auto" });
    }
  }, [location.key]);

  return null;
}
