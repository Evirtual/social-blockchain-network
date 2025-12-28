import type { Interface } from "ethers";
import { scanActiveToggleKeys } from "@shared/lib/toggleScan";

type ToggleScanArgs = {
  readContract: any;
  scanProvider: any;
  iface: Interface;

  address: string;
  onFilter: any;
  offFilter: any;
  onEventName: string;
  offEventName: string;

  tokenIdArgIndex: number;

  maxRounds?: number;
  maxEvents?: number;
  initialWindowSize?: number;
  minWindowSize?: number;
  timeoutMs?: number;
};

export async function scanToggleEventsForAddress(args: ToggleScanArgs): Promise<string[]> {
  const { address, onEventName, offEventName } = args;
  return scanActiveToggleKeys({
    readContract: args.readContract,
    scanProvider: args.scanProvider,
    iface: args.iface,
    onFilter: args.onFilter,
    offFilter: args.offFilter,
    onEventName: args.onEventName,
    offEventName: args.offEventName,
    keyArgIndex: args.tokenIdArgIndex,
    keyArgType: "bigint",
    maxRounds: args.maxRounds,
    maxEvents: args.maxEvents,
    initialWindowSize: args.initialWindowSize,
    minWindowSize: args.minWindowSize,
    timeoutMs: args.timeoutMs,
    errorLabel: `${address} ${onEventName}/${offEventName}`
  });
}
