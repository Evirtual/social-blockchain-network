# Features

This folder is the app’s **feature-first architecture**.

## Goals

- Keep each capability (feed, composer, social actions, profile, follow, ipfs/metadata, tx, contract, app shell) self-contained.
- Make dependencies explicit and reduce cross-cutting “god folders”.
- Prefer stable public entrypoints (`index.ts`) per feature.

## Common structure

Most features follow some combination of:

- `components/` UI pieces
- `hooks/` React hooks
- `services/` non-React logic (RPC/log scanning, caching, metadata/IPFS)
- `pages/` route-level UI

`features/app` owns the provider tree and routes.

## Import rules (avoid cycles)

- **Consumers** (routes/pages/providers) can import from feature barrels.
- **Implementation modules** inside a feature should avoid importing from that feature’s own barrel (e.g. don’t do `from "../index"` inside the same feature). Import the concrete module path instead.

## Aliases

- `@features/*` → `src/features/*`
- `@shared/*` → `src/features/shared/*`
- `@types` → `src/types.ts`

Rule of thumb:

- If it’s truly cross-feature, put it under `@shared`.
- If it’s domain-specific, keep it inside its feature.
