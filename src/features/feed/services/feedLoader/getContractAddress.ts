import type { Contract } from "ethers";

export function getContractAddress(readContract: Contract): string {
  const addr = readContract?.target ?? readContract?.address;
  return String(addr ?? "");
}
