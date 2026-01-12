function getErrMsg(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err) {
    return String((err as { message?: unknown }).message ?? "");
  }
  return String(err ?? "");
}

export function isLikelySubgraphSchemaMismatch(err: unknown): boolean {
  const m = getErrMsg(err).toLowerCase();
  return (
    m.includes("cannot query field") ||
    m.includes("has no field") ||
    m.includes("unknown type") ||
    m.includes("unknown argument") ||
    m.includes("unknown field") ||
    m.includes("unknown value") ||
    m.includes("expected type")
  );
}
