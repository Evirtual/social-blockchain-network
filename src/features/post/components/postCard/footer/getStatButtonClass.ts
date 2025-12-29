export function getStatButtonClass(params: {
  requiresNetworkSwitch: boolean;
  extra?: string;
  active?: string;
}): string {
  const { requiresNetworkSwitch, extra, active } = params;
  return [
    "postActionIcon",
    extra || "",
    requiresNetworkSwitch ? "notAllowed" : "",
    active || ""
  ]
    .filter(Boolean)
    .join(" ");
}
