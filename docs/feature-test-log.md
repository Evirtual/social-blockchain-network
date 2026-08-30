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
| Console | Throughout | No JavaScript errors or unhandled rejections |

## Found and fixed during the sweep

**Media blocked on the LAN origin.** Only the subgraph worker had the LAN
address in its CORS allowlist. Loading the dev server from another device
rendered posts and counts but no images, video or avatars, and uploads would
have failed. The media and pinata workers now allow it too. This is why testing
from a phone would have looked broken.

## Found, not yet fixed

**A failed network switch is silent.** Choosing a different network in the
Networks dialog issues `wallet_switchEthereumChain`. When that call fails or is
rejected, nothing is shown: the dialog keeps the previous network selected and
the user gets no indication their choice did not take effect.

**Unknown routes fall back to the feed.** `#/does-not-exist` renders the home
page rather than a not-found state. Harmless, but a visitor following a stale
link has no idea the address was wrong.

## Not yet exercised

Everything below needs a signed transaction and so has not been tested:

- Minting a post, including image and video upload through IPFS
- Editing and burning a post
- Like, unlike, save, unsave
- Commenting, editing and deleting a comment
- Tipping a post or comment, and the support-percentage split
- Follow and unfollow
- Withdrawing tips
- Requesting posting approval, and the owner approving or disapproving
- Admin moderation: editing a profile, clearing a profile, removing a post

The insufficient-balance path on tipping is worth exercising deliberately, since
that was the original reported bug and its fix has only been unit tested.
