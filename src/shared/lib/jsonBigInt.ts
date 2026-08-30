/**
 * JSON serialisation that survives BigInt.
 *
 * Values read from chain and subgraph carry BigInt fields - tip amounts, block
 * numbers - and `JSON.stringify` throws on them outright. Caches that stringify
 * without handling this fail on every write, and because those writes are
 * wrapped in a best-effort try/catch the failure is invisible: the cache simply
 * never holds anything and every read goes to the network.
 */

const BIGINT_TAG = "__bigint__";

type TaggedBigInt = { [BIGINT_TAG]: string };

function isTaggedBigInt(value: unknown): value is TaggedBigInt {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as TaggedBigInt)[BIGINT_TAG] === "string"
  );
}

export function stringifyWithBigInt(value: unknown): string {
  return JSON.stringify(value, (_key, raw) =>
    typeof raw === "bigint" ? ({ [BIGINT_TAG]: raw.toString() } satisfies TaggedBigInt) : raw
  );
}

export function parseWithBigInt<T>(text: string): T {
  return JSON.parse(text, (_key, raw) => {
    if (!isTaggedBigInt(raw)) return raw;
    try {
      return BigInt(raw[BIGINT_TAG]);
    } catch {
      return null;
    }
  }) as T;
}
