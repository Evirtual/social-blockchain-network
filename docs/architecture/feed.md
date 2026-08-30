# Feed

64 files, ~5,400 lines - the largest feature, and the source of most subgraph
traffic. Reviewed and partially covered on 2026-08-30.

## Two ways to load, in that order

The feed reads from the subgraph where one is configured, and falls back to
reading logs over RPC where it is not. `services/feedRefresh.ts` runs both in
two phases:

```
                       selected networks
                              │
        ┌─────────────────────┴─────────────────────┐
        │ Phase 1: subgraph, all chains in parallel │
        │   loadFeedFromSubgraph, 25s timeout each  │
        └─────────────────────┬─────────────────────┘
                              │  per-chain ok / failed
        ┌─────────────────────┴─────────────────────┐
        │ Phase 2: RPC, only for chains that had no │
        │ subgraph configured or whose attempt failed│
        │   loadFeedFromProvider                     │
        └─────────────────────┬─────────────────────┘
                              │
                    mergePosts into state
```

The fallback is per chain, not all-or-nothing: one chain's subgraph failing does
not push the others onto RPC. Results from both phases go through `mergePosts`,
so partial results accumulate rather than replacing each other.

`loadFeedFromProvider` is much heavier than the subgraph path - it pages event
logs, resolves token metadata, and refreshes counters - which is why it exists
only as a fallback.

## Files that carry the logic

| File | Role |
|---|---|
| `services/feedRefresh.ts` | Orchestrates the two phases across the selected networks. |
| `services/feedLoader.ts` | The RPC path: paged log queries, metadata resolution, counter refresh. The largest and least covered file in the feature. |
| `services/subgraph/loadFeedFromSubgraph.ts` | The subgraph path. Six query variants covering filter combinations, plus a minimal fallback. |
| `services/feedPosts.ts` | `mergePosts` and `sortPostsNewestFirst`. |
| `services/filterPosts.ts` | Network and search filtering for what is on screen. |
| `hooks/useFeedRefresh.ts` | When to refresh: chain events, visibility, throttling. |
| `providers/FeedProvider.tsx` | Holds posts and the approval gate. |
| `services/subgraph/subgraphCache.ts` | Capped in-memory caches for counts and remote search. |

## Things worth knowing

**An empty network selection shows nothing, not everything.** `filterPosts`
returns `[]` when `selectedNetworkChainIds` is empty. Clearing every filter
empties the feed rather than opening it up.

**Search needs three characters.** Shorter queries are ignored and the
network-filtered list is returned unchanged. Search covers the post body, the
author's address, their profile name, and the shortened address as displayed,
since that last form is what people see and therefore type.

**`mergePosts` preserves the array reference** when nothing meaningful changed,
which lets React skip re-rendering the list on a refresh that found no news.
`contextTag` is deliberately excluded from the comparison: it is page-level UI
state, not post data.

**Posts are identified by chain and token together.** Token ids restart per
deployment, so the same id exists on every network.

**Author identity is per chain**, resolved through `profileKey`. One address can
hold a different name and avatar on each network - see
`docs/architecture/notifications.md` for the same reasoning applied elsewhere.

**Six query variants in the subgraph loader are filter permutations**, not a
compatibility ladder: author, author list, and body search combine into separate
queries. Only `queryMinimal` is a fallback, used when the deployed schema is
older than the client.

## Covered by tests

- `feedPosts` - merge and sort, including the reference-preserving behaviour and
  every field that counts as a change
- `filterPosts` - network filtering, the empty-selection rule, and each search
  target
- `feedStorageKeys` - per-scope search keys, shared network selection
- `subgraphCache` - order-independent keys, capped eviction
- `computeCommentsFromBlock` - resume points and the mint-block hint
- `getAuthorPresentation` - per-chain identity and every fallback

## Not covered

`feedLoader.ts` and `loadFeedFromSubgraph.ts`, the two largest files, both need
either a fake provider or a fake subgraph to test. `useFeedRefresh` and
`FeedProvider` need a component harness. These are the next increment for this
feature.
