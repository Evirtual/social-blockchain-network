export function parseTipAmountRaw(amountRaw: string) {
  const raw = (amountRaw ?? "").trim();
  const amount = raw.length ? Number(raw) : 0;
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false as const, error: "Enter a valid tip amount." };
  }
  return { ok: true as const, raw };
}
