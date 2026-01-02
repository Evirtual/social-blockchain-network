import { useMemo } from "react";
import { getSupportedNetworks } from "../services/supportedNetworks";

export function useSupportedNetworks() {
  return useMemo(() => getSupportedNetworks(), []);
}
