# Notifications

14 files, ~1,500 lines. Reviewed and covered on 2026-08-30.

## Where the data comes from

Notifications are **not** derived in the browser. The subgraph materialises a
`Notification` entity per recipient as it indexes events, so the client only
reads them.

```
SocialPosts.sol  ──emits──▶  subgraph/src/mapping.ts  ──▶  Notification entity
                                                              │
                                       workers/subgraph  ◀────┘  (proxy + cache)
                                              │
                            loadNotificationsFromSubgraph
                                       ┌──────┴──────┐
                              useNotifications   useNotificationsBadge
                                       │                │
                          NotificationsModal      unread dot
                          NotificationsHistoryPage
```

The contract emits per-recipient events deliberately so the indexer never has to
make contract calls — see the comment at `SocialPosts.sol:281`.

Recipient resolution happens **in the mapping, not the client**. For a like, the
mapping loads the Post to find its author (`mapping.ts:439`). The browser cannot
determine a like's recipient from the event alone; this matters for anything
trying to filter events by relevance.

The mapping never notifies an actor about their own action
(`mapping.ts:110` and siblings), which is what makes `isSelfOnlyEvent` safe.

## Files

| File | Role |
|---|---|
| `services/loadNotificationsFromSubgraph.ts` | The only network read. Local cache (20s), in-flight dedupe, plus a second `BurnedPosts` query per load. |
| `hooks/useNotifications.ts` | List state for the modal and history page. Initial load + event-driven refresh. |
| `hooks/useNotificationsBadge.ts` | Unread dot only. Loads the same data independently. |
| `services/notificationReadState.ts` | "Last seen" mark in localStorage, per chain + wallet. Broadcasts a DOM event on write. |
| `services/notificationViewPrefs.ts` | Whether removed/burned items are shown on the history page. |
| `lib/notificationFilters.ts` | Hides retractions (unlike, unfollow…) from non-owners. |
| `lib/notificationText.ts` | Kind → wording. Unknown kinds fall back rather than breaking. |
| `lib/isBurnedNotification.ts` | Cross-references the burned-post cache. |
| `components/NotificationsList.tsx` | Row rendering and navigation targets. |

## Things worth knowing

**Two independent consumers of the same data.** `useNotifications` and
`useNotificationsBadge` both call `loadNotificationsFromSubgraph` with different
`first` values, which produces different cache keys, so they do not share a
cached result. Two loads, four requests, for one screen.

**Each load costs two requests**, not one: the notifications query plus a
`BurnedPosts` lookup for the token ids it returned.

**The last-seen event is unconditional.** `writeNotificationsLastSeen` dispatches
its change event on every write, including writes that set the same value, and
the badge recomputes on that event.

**`useNotifications` has no single state machine.** The initial-load effect
clears `items` on error; the refresh effect only writes when the result is
non-empty and swallows its errors. `loading`, `error` and `items` can therefore
disagree, which is the cause of the panel appearing to flicker between two
states. This is the main outstanding issue in the feature.

## Covered by tests

- `notificationText` — every declared kind has distinct wording; unknown kinds fall back
- `notificationFilters` — retractions hidden from viewers, kept for the owner
- `notificationReadState` — key scoping, round-trip, subscriber behaviour, unread counting

Not covered: the two hooks and the loader, which need either a component
harness or a fake subgraph. That is the next increment for this feature.
