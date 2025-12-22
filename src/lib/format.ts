export function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function stableHueFromSeed(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h % 360;
}
