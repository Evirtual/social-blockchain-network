import type { PostComment } from "@types";

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashToSeed(input: string): number {
  // Small deterministic hash (djb2-ish) for demo-only seeding.
  let h = 5381;
  for (let i = 0; i < input.length; i += 1) {
    h = ((h << 5) + h) ^ input.charCodeAt(i);
    h |= 0;
  }
  return h >>> 0;
}

function toHexAddress(n: number): string {
  const hex = (n >>> 0).toString(16).padStart(8, "0");
  return `0x${"0".repeat(32)}${hex}`;
}

function pick<T>(rand: () => number, items: T[]): T {
  return items[Math.floor(rand() * items.length)]!;
}

export function generateDemoComments(args: {
  tokenId: string;
  postChainId?: string | null;
  count: number;
  seed?: number;
}): PostComment[] {
  const count = Math.max(0, Math.min(250, Math.floor(args.count ?? 0)));
  if (count <= 0) return [];

  const baseSeed = typeof args.seed === "number" ? args.seed : hashToSeed(`${args.postChainId ?? ""}::${args.tokenId}`);
  const rand = mulberry32(baseSeed);

  const rootBodies = [
    "Nice post.",
    "This is actually a great idea.",
    "Demo data, real vibes.",
    "Ship it.",
    "What chain is this on?",
    "I like the UI.",
    "Rate limits are painful—smart gating.",
    "Looks good to me.",
    "How do I get approved?",
    "Can’t wait for mainnet.",
    "Big if true.",
    "Bookmarking this.",
    "Love the gradient.",
    "Wen feature complete?",
    "This comment is also demo-generated."
  ];

  const replyBodies = [
    "Agree.",
    "Same here.",
    "Yep.",
    "100%.",
    "That makes sense.",
    "Good point.",
    "Thanks for sharing.",
    "I was wondering the same.",
    "Can confirm.",
    "Nice catch."
  ];

  const rootCount = Math.max(1, Math.min(count, Math.round(count * 0.65)));
  const replyCount = Math.max(0, count - rootCount);

  const comments: PostComment[] = [];

  const rootIds: string[] = [];
  for (let i = 0; i < rootCount; i += 1) {
    const author = toHexAddress((baseSeed + (i + 1) * 2654435761) >>> 0);
    const likeCount = Math.floor(rand() * 20);
    const saveCount = Math.floor(rand() * 8);
    const commentId = String(1_000_000 + ((baseSeed + i) % 900_000));
    rootIds.push(commentId);

    comments.push({
      // Keep commentId numeric-like so on-chain actions won't throw if invoked.
      commentId,
      tokenId: String(args.tokenId),
      author,
      parentId: null,
      comment: pick(rand, rootBodies),
      deleted: false,
      edited: false,
      likeCount,
      saveCount,
      tipWei: 0n
    });
  }

  for (let i = 0; i < replyCount; i += 1) {
    const offset = rootCount + i;
    const author = toHexAddress((baseSeed + (offset + 1) * 2654435761) >>> 0);
    const likeCount = Math.floor(rand() * 12);
    const saveCount = Math.floor(rand() * 5);
    const commentId = String(1_000_000 + ((baseSeed + offset) % 900_000));

    // Some replies are nested (reply-to-reply) but always within the same root thread.
    const parentId = rand() < 0.25 && comments.length > 0 ? pick(rand, comments).commentId : pick(rand, rootIds);

    comments.push({
      commentId,
      tokenId: String(args.tokenId),
      author,
      parentId,
      comment: pick(rand, replyBodies),
      deleted: false,
      edited: false,
      likeCount,
      saveCount,
      tipWei: 0n
    });
  }

  return comments;
}
