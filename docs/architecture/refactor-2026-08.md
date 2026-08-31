# Refactor, August 2026

The question was whether to rebuild the frontend or refactor it. The answer was
refactor, and this records why, so it does not have to be re-derived if the
question comes back.

## What the review found

Static analysis of 410 files and ~30,000 lines. The codebase was in better shape
than it looked: `strict: true`, zero `@ts-ignore`, 24 uses of `any`, largest file
575 lines, and the contract, subgraph and workers all sound.

One real defect, and it was mechanical.

**46 import cycles, 45 of them caused by barrels.** Importing `@features/post`
pulled in all of post, which pulled in profile, which reached back to feed - four
features knotted together because a barrel turns a narrow dependency into a
whole-feature one. `Feed.tsx` needed one component from post.

Cycles matter because module initialisation order becomes fragile: a module can
evaluate before something it depends on is ready and see `undefined`, which
produces bugs that look random and depend on load order. They also cost real
time. A dead-code scan returned 627 false positives because barrels re-export
names without mentioning them, and genuinely dead code sat hidden behind three
re-export hops.

Alongside that: four stateless helpers were threaded through the component tree
as props rather than imported (`shortAddress` was a prop in 32 files and an
import in 6), and `contract` - the most depended-on module - imported from
`feed`, which is the wrong direction.

## Why not a rebuild

The hard parts are not the frontend. The contract, the subgraph and the three
workers were done and proven against three chains, and a rebuild would carry
them over unchanged - so "rebuild" meant rewriting the cheapest layer while
keeping the expensive ones.

It would also have discarded knowledge that only exists because the app was run.
Thirteen bugs were fixed in the days before the review and nearly none were
findable by reading: a cache that had never once written because `JSON.stringify`
throws on BigInt, a CORS gap that hid all media on the LAN origin, a rate limiter
that ran before the cache lookup.

## What was done

21 pull requests, #13 to #34.

- 1,333 lines of dead code removed - functions gutted to `void args;` under
  comments still describing the behaviour they no longer had, orphaned files, a
  duplicate module, unused styles, an unused dependency
- Import cycles 46 to 0, held there by `npm run check:cycles` in CI
- The post actions controller, which already existed and was being unpacked into
  21 props at every level, handed down whole: `PostCard` 53 props to 14,
  `CommentItem` 47 to 32
- CI changed to run once per PR against the merge result, and branch protection
  added so red checks block a merge

## Conventions this left behind

- Relative imports inside a feature, path aliases across features and to shared.
  Never a relative path crossing a feature boundary.
- Point the alias at the module, not the barrel, for anything other features
  depend on heavily. Barrels remain for leaf features that cannot cycle, and CI
  catches it if that ever changes.
- A small type shared between a component and its helper gets its own file.
  `PostPanel` and `ProfileRecord` were the last two cycles, both caused by a type
  living in the component its helper needed.

## Where the estimate was wrong

The review predicted that dropping the threaded helpers would take `PostCard`
from 53 props to about 35. It reached 49 that way, because each component
declared the four helpers only once. It got to 14 by a route the plan never
mentioned: the abstraction was not missing, it was being taken apart and
reassembled at every level.

## When a rebuild would be the right call

Three conditions, and only the first is about the code:

- Adding a feature routinely means touching ten or more files. That is testable -
  pick a real feature and count.
- The rebuild is the point, as a deliberate exercise rather than a way to ship.
- A specific buyer or employer wants a specific stack.

Not a reason: that the code was written with a previous model. None of the bugs
found were characteristically model-generated; they were ordinary bugs.
