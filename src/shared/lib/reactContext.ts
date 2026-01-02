export function requireContext<T>(
  value: T | null | undefined,
  hookName: string,
  providerName: string
): T {
  if (value == null) {
    throw new Error(`${hookName} must be used within <${providerName}>`);
  }
  return value;
}
