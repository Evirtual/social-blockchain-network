export type ErrorInput = Error | { message?: string } | string | number | boolean | null | undefined;

type ErrorLike = {
  code?: string | number;
  message?: string;
  reason?: string;
  shortMessage?: string;
  data?: {
    message?: string;
    error?: { message?: string; data?: { message?: string; error?: { message?: string } } };
  };
  error?: { message?: string; data?: { message?: string } };
  info?: { error?: { message?: string; data?: { message?: string; error?: { message?: string } } } };
  cause?: { shortMessage?: string; reason?: string; message?: string };
};

function toErrorLike(error: ErrorInput): ErrorLike {
  if (error && typeof error === "object") return error as ErrorLike;
  return {};
}

export function getErrorMessage(error: ErrorInput) {
  const err = toErrorLike(error);

  // MetaMask / EIP-1193 user rejected
  if (err.code === 4001 || err.code === "ACTION_REJECTED") {
    return "Transaction rejected in wallet.";
  }

  const pickString = (...values: Array<string | null | undefined>) => {
    for (const v of values) {
      if (typeof v === "string" && v.trim()) return v;
    }
    return null;
  };

  // Ethers / wallet providers often wrap the "real" error several layers deep.
  const nestedMessage = pickString(
    err.info?.error?.message,
    err.info?.error?.data?.message,
    err.info?.error?.data?.error?.message,
    err.error?.message,
    err.error?.data?.message,
    err.data?.message,
    err.cause?.shortMessage,
    err.cause?.reason,
    err.cause?.message
  );

  // Ethers v6 common fields
  const shortMessage = pickString(err.shortMessage);
  const reason = pickString(err.reason);
  const message = pickString(err.message);

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
