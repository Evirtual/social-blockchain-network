export function normalizeAddress(address: string | null | undefined): string {
  if (!address) return "";
  return address.trim().toLowerCase();
}
