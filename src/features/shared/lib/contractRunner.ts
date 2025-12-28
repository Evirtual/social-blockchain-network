export function getScanProviderFromReadContract(readContract: any, fallback?: any): any {
  const runner: any = readContract?.runner;
  return runner?.provider ?? runner ?? fallback ?? null;
}
