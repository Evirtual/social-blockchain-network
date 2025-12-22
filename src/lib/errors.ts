export function getErrorMessage(error: unknown) {
  const anyErr = error as any;

  // MetaMask / EIP-1193 user rejected
  if (anyErr?.code === 4001 || anyErr?.code === "ACTION_REJECTED") {
    return "Transaction rejected in wallet.";
  }

  // Ethers v6 common fields
  const shortMessage = typeof anyErr?.shortMessage === "string" ? anyErr.shortMessage : null;
  const reason = typeof anyErr?.reason === "string" ? anyErr.reason : null;
  const message = typeof anyErr?.message === "string" ? anyErr.message : null;

  const combined = shortMessage ?? reason ?? message ?? "Transaction failed.";

  if (combined.toLowerCase().includes("missing revert data")) {
    return "Transaction reverted (no reason returned). This commonly happens when the post metadata is too large (e.g. big uploaded images). Try a smaller image, or use an image URL (IPFS/http).";
  }

  if (combined.toLowerCase().includes("insufficient funds")) {
    return "Insufficient funds for gas.";
  }
  if (combined.toLowerCase().includes("eaddrinuse")) {
    return "Local RPC port is already in use.";
  }
  return combined;
}
