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

## Not yet exercised

Everything below needs a signed transaction and so has not been tested:

- Minting a post with a video, and the video trim step
- Editing and burning a post
- Tipping a comment, and the support-percentage split on either
- Like, unlike, save, unsave
- Commenting, editing and deleting a comment
- Follow and unfollow
- Withdrawing tips
- Requesting posting approval, and the owner approving or disapproving
- Admin moderation: editing a profile, clearing a profile, removing a post
