Shared, cross-feature utilities.

Use this for small, generic primitives that are needed across multiple features.

Examples in this repo:

- RPC/query helpers: `feedQuery`, `rpc`, `contractRunner`
- Concurrency + in-flight dedupe: `async`, `inFlight`
- Identifiers + timing: `ids`, `time`
- Common scanners: `toggleScan`

Guideline:

- If a helper is only used by one feature, keep it in that feature.
- If it’s reused across features and has no domain meaning, it belongs here.
