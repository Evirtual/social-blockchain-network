export function getStatButtonClass(params: {
  requiresNetworkSwitch: boolean;
  extra?: string;
  active?: string;
}): string {
  const { requiresNetworkSwitch, extra, active } = params;
  return [
    "statPill",
    "statButton",
    extra || "",
    requiresNetworkSwitch ? "notAllowed" : "",
    active || ""
  ]
    .filter(Boolean)
    .join(" ");
}
