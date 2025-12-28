export function getContractAddress(readContract: any): string {
  const addr = (readContract as any)?.target ?? (readContract as any)?.address;
  return String(addr ?? "");
}
