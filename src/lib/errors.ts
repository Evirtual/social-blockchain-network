export function getErrorMessage(error: unknown) {
  const anyErr = error as any;

  // MetaMask / EIP-1193 user rejected
  if (anyErr?.code === 4001 || anyErr?.code === "ACTION_REJECTED") {
    return "Transaction rejected in wallet.";
  }

  const pickString = (...values: unknown[]) => {
    for (const v of values) {
      if (typeof v === "string" && v.trim()) return v;
    }
    return null;
  };

  // Ethers / wallet providers often wrap the "real" error several layers deep.
  const nestedMessage = pickString(
    anyErr?.info?.error?.message,
    anyErr?.info?.error?.data?.message,
    anyErr?.info?.error?.data?.error?.message,
    anyErr?.error?.message,
    anyErr?.error?.data?.message,
    anyErr?.data?.message,
    anyErr?.cause?.shortMessage,
    anyErr?.cause?.reason,
    anyErr?.cause?.message
  );

  // Ethers v6 common fields
  const shortMessage = pickString(anyErr?.shortMessage);
  const reason = pickString(anyErr?.reason);
  const message = pickString(anyErr?.message);

  // Prefer useful nested context when ethers shows a generic coalescing error.
  const combinedRaw = shortMessage ?? reason ?? message ?? nestedMessage ?? "Transaction failed.";
  const combined =
    typeof combinedRaw === "string" && combinedRaw.toLowerCase().includes("could not coalesce error")
      ? nestedMessage ?? combinedRaw
      : combinedRaw;

  const lower = combined.toLowerCase();

  // Common JSON-RPC / provider failures
  if (lower.includes("429") || lower.includes("too many requests") || lower.includes("rate limit")) {
    return "RPC rate limit reached. Try again in a moment, or switch RPC endpoint.";
  }
  if (
    lower.includes("unterminated string in json") ||
    lower.includes("unexpected end of json") ||
    lower.includes("invalid json") ||
    lower.includes("invalid json rpc")
  ) {
    return "RPC returned a malformed response. Try again, or switch RPC endpoint.";
  }
  if (lower.includes("failed to fetch") || lower.includes("network error") || lower.includes("timeout")) {
    return "Network/RPC error. Check your RPC endpoint (or local node) and try again.";
  }

  // Extract revert reasons when present.
  // Examples: "execution reverted: Poster not allowed", "VM Exception while processing transaction: reverted with reason string '...'"
  const execReverted = lower.includes("execution reverted");
  if (execReverted) {
    const idx = Math.max(lower.indexOf("execution reverted"), 0);
    const tail = combined.slice(idx);
    const colon = tail.indexOf(":");
    const reasonText = colon >= 0 ? tail.slice(colon + 1).trim() : "";
    return reasonText ? `Transaction reverted: ${reasonText}` : "Transaction reverted.";
  }

  if (lower.includes("missing revert data")) {
    return "Transaction reverted (no reason returned). This commonly happens when the post metadata is too large (e.g. big uploaded images). Try a smaller image, or use an image URL (IPFS/http).";
  }

  if (lower.includes("insufficient funds")) {
    return "Insufficient funds for gas.";
  }
  if (lower.includes("eaddrinuse")) {
    return "Local RPC port is already in use.";
  }
  return combined;
}
