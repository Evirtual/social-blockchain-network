# Feature test log

Manual sweep of the running app, 2026-08-30. Read and navigation paths only;
write paths that require a signed transaction are listed at the end as not yet
exercised.

Two environments were used: a headless EIP-1193 stub in an automated browser
(covers every read path and UI state, cannot sign), and the real browser against
the LAN dev origin.

## Working

| Area | Checked | Result |
|---|---|---|
| Feed, disconnected | Loads all three testnets | Posts, media, counts and per-chain author identities all correct |
| Feed, connected | Defaults to the wallet's network | Shows only that chain's posts, as designed |
| Author identity | Same address across three chains | Resolves each chain's own profile: "BSC Origin", "Base Origin", "Ethereum Origin" |
| Post detail | Opened from feed | Comments render, no stuck loading state |
| Own profile | Connected as the owner | Edit, approvals, wallet panel, balance, tips and Withdraw all present |
| Other profile | Connected as a different account | Follow button resolves, no stuck skeleton |
| Empty profile | Address with no activity | Renders "No bio yet" and a Follow action rather than an error |
| Notifications panel | Opened repeatedly | Two subgraph requests total; cache holds |
| Notification history | Full page | Real notifications listed with actor names |
| Search | Query submitted | Returns results |
| Theme toggle | Dark to light | Switches correctly; both themes render properly |
| Network switch failure | Rejected in the wallet | Dialog stays open and reports "Network switch cancelled in wallet." |
| Console | Throughout | No JavaScript errors or unhandled rejections |

## Found and fixed during the sweep

**Media blocked on the LAN origin.** Only the subgraph worker had the LAN
address in its CORS allowlist. Loading the dev server from another device
rendered posts and counts but no images, video or avatars, and uploads would
have failed. The media and pinata workers now allow it too. This is why testing
from a phone would have looked broken.

## Found, not yet fixed

**The wrong-network prompt on the home page ignores the outcome.** The Networks
dialog now reports a failed or rejected switch, but
`HomePage.requestWalletNetworkSwitch` discards the result and has no surface to
show a message on.

**Unknown routes fall back to the feed.** `#/does-not-exist` renders the home
page rather than a not-found state. Harmless, but a visitor following a stale
link has no idea the address was wrong.

## Write paths exercised

Tested against Base Sepolia with a real wallet (Rabby).

**Tipping more than the balance.** Rejected before any transaction: no wallet
prompt, no gas, and the dialog shows "Not enough balance to tip 1. You have
0.079773, and gas is charged on top." This was the originally reported bug,
where the message wrongly blamed image size.

**Tipping an affordable amount.** 0.00001 ETH passed the balance check, reached
the wallet, and settled. The post total moved 0.000385 to 0.000395 immediately
and the dialog closed. The optimistic update means the tipper sees their own
action at once rather than waiting for the subgraph, so the fifteen second
event throttle does not delay self-initiated feedback.

**Minting a text post.** Composer validation clamps the body at 280 characters,
dropping anything typed past the limit rather than letting an oversized post
reach the chain. The mint reached the wallet, settled, and the post appeared at
the top of the feed with its counters at zero.

**Minting a post with an image.** Selecting a file opens a crop step before the
composer accepts it. The upload through the pinata worker completed, the mint
settled, and the image renders in the feed, fetched back through the media
worker. This exercises the whole chain: crop, IPFS upload, metadata, mint, and
media retrieval.

**Minting a post with a video.** Selecting a video opens a trim step with a
preview, draggable start and end handles, a live clip duration and a thirty
second cap. Dragging the end handle from 0:05 to 0:02.83 updated the duration
live, and applying the trim re-encoded the clip: the composer preview came back
at 0:02 rather than the original 0:05. The upload and mint settled and the post
renders in the feed playing the trimmed clip.

**Burning a post.** Removes the post from the feed once the transaction
settles, and the surrounding posts keep their counters. Burning is permanent,
and the button commits to it immediately: there is no confirmation step in the
app, so the wallet prompt is the only thing between a mis-click and a destroyed
post. Worth a confirmation dialog, since every other destructive action in the
app is reached through a menu rather than a single icon in the post header.

## Write paths exercised, second sweep

Base Sepolia, real wallet (Rabby), 2026-08-30.

**Editing a post.** Save stays disabled until the text actually changes. The
edit uploads new metadata before asking for a signature, so there is a pause
with a spinner before the wallet appears. Confirmed both directions: appending
to the text and reverting it. The post keeps its likes, saves, comments and
tips across the edit, and the feed shows the new text as soon as the receipt
lands.

One wrinkle worth noting: the success toast reads "confirmed" while its message
says "Post updated - finalizing media...", so it claims to be finished and still
working at the same time.

**Commenting.** Posts, clears the input, and the new comment appears with its
own actions and a zero tip total. The toast said "confirm in wallet" while the
wallet was open, which is clearer than the "in progress" wording used elsewhere.

**Editing a comment.** Inline editor, Save disabled until changed, and the
"Edited" badge appears on the comment once the receipt lands.

**Deleting a comment.** Works, and removes the comment from the list.

## Found and fixed during this sweep

**Deleting a comment had no confirmation.** One click on a small trash icon went
straight to the wallet - the same shape as the post burn issue found in the
first sweep, which had already been given a confirmation dialog. The wallet
prompt is not a substitute: it confirms a transaction rather than an intent,
showing a contract call rather than what is about to be lost, and it is exactly
the kind of dialog people learn to click through. Comment deletion now asks
first, matching post burning. The two dialogs share one set of styles, renamed
from burnConfirm to confirmDialog now that they serve both.


## Write paths exercised, third sweep

BSC Testnet, real wallet (Rabby), 2026-08-31.

**Replying to a comment.** Posts and renders nested under its parent with an
@mention of the parent's author. Tight against the parent rather than spaced
apart, which is how a reply is distinguished from a sibling comment.

**Tipping a comment, with the support split.** The panel offers 1, 3, 5 and 10
percent and a "save as default" toggle. Choosing a percentage shows the split
live before signing - 0.0001 BNB at 3 percent previewed as 0.000097 to the
author and 0.000003 to the protocol - and the comment's total afterwards read
0.000097, so the figure that reached the chain matched the preview.

**Deleting a comment.** The confirmation added earlier this cycle behaves as
intended in real use: it names the comment being deleted, and only the dialog's
own button sends anything.

**Follow and unfollow.** Round-tripped against another account holding a
profile. The button flips between Follow and Unfollow and the state survives, so
the follow record is read back rather than only held locally. The button spins
for as long as the transaction is pending - about forty seconds here - which is
the in-flight state working rather than a stall.


**Withdrawing tips.** The dialog names the treasury, its wallet balance and
the withdrawable amount before anything is signed. Withdrawing moved the tips
into the wallet: balance 0.0002 to 0.0050 BNB and tips 0.0047 to 0, which is the
0.004788 withdrawable less gas. The card updated as soon as it settled.

The wallet card reads 0.0047 where the dialog reads 0.004788, because balances
are truncated rather than rounded. That is deliberate: rounding up would show a
balance larger than the one actually held, and truncating can only ever
understate it. Recorded here because it looks like an inconsistency at a glance
and is not one.


**Followers and following stuck loading.** Seen once on the public site and
never on localhost: the counts sat as skeletons indefinitely, with no console
error and nothing retrying. The cause was an asymmetry in `useFollowScans` -
clearing a loading flag was guarded against a stale epoch, setting it was not.
A chain switch landing during the subgraph round trip reset the loading maps,
then the in-flight request wrote its flag back as true, and its `finally`
declined to clear it because the epoch was by then stale. Only reachable when
the round trip is slow enough for a chain change to land inside it, which is
why localhost never showed it. Covered by a regression test that fails without
the guard.

**Feed spinner stuck after a wallet switch.** Found by auditing the other two
hooks that share the epoch guard, not from a report. `useFeedRefresh` bumps the
epoch on a chain *or* wallet change but only clears the posts on a chain change.
On a wallet switch the in-flight refresh had already turned the spinner on, its
`finally` then declined to turn it off because the epoch was stale, and the next
refresh saw a populated feed so never touched the flag at all - leaving it on for
good. Fixed by clearing the flag as part of the reset, alongside the epoch bump.
Covered by a regression test that fails without it. `useProfilesState` shares the
guard but is clean: its epoch-guarded path sets no loading flag, and its two flags
are set and cleared symmetrically outside that path.

**Follow bundle skipped after a chain switch.** Found while refactoring, not
from a report. One bundled query answers followers, following and the count
together, and a per-address mark stops it repeating. The chain-change reset
cleared every other mark but not that one, so after the first switch the bundle
was skipped for good and each loader fell through to its own query. The data
stayed correct - three round trips where one would do. Covered by a test that
fails against the old code.

## Not yet exercised

Everything below needs a signed transaction and so has not been tested:

- Requesting posting approval, and the owner approving or disapproving
- Admin moderation: editing a profile, clearing a profile, removing a post

Both need a second account able to sign as the requester, not just a second
address to point at. Three requesters already sit in the approvals list from
chain, so the owner half could be exercised against those without arranging
anything - but approving one is a real grant, not a reversible test.
