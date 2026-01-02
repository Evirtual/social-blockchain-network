import type { Contract, ContractEventName, Interface, Provider } from "ethers";
import { scanActiveToggleKeys } from "@shared/lib/toggleScan";

type ScanFollowToggleArgs = {
  readContract: Contract;
  scanProvider: Provider;
  iface: Interface;

  followedFilter: ContractEventName;
  unfollowedFilter: ContractEventName;

  addressArgIndex: number;

  maxRounds?: number;
  maxEvents?: number;
  initialWindowSize?: number;
  minWindowSize?: number;
  errorLabel?: string;
  timeoutMs?: number;
};

export async function scanActiveFollowAddresses(args: ScanFollowToggleArgs): Promise<string[]> {
  return scanActiveToggleKeys({
    readContract: args.readContract,
    scanProvider: args.scanProvider,
    iface: args.iface,
    onFilter: args.followedFilter,
    offFilter: args.unfollowedFilter,
    onEventName: "Followed",
    offEventName: "Unfollowed",
    keyArgIndex: args.addressArgIndex,
    keyArgType: "string",
    normalizeKey: (k) => k.toLowerCase(),
    maxRounds: args.maxRounds,
    maxEvents: args.maxEvents,
    initialWindowSize: args.initialWindowSize,
    minWindowSize: args.minWindowSize,
    timeoutMs: args.timeoutMs,
    errorLabel: args.errorLabel ?? "follow"
  });
}
