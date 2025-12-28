import type { Location } from "react-router-dom";

export function getFeedFromLocation(location: Location): string {
  const from = (location.state as { from?: string } | null)?.from;
  return from ?? `${location.pathname}${location.search}`;
}
