import type { Post } from "@types";

export const DEMO_CHAIN_IDS = ["11155111", "84532", "97"] as const;

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

function pick<T>(rand: () => number, items: T[]): T {
  return items[Math.floor(rand() * items.length)]!;
}

function toHexAddress(n: number): string {
  const hex = (n >>> 0).toString(16).padStart(8, "0");
  return `0x${"0".repeat(32)}${hex}`;
}

function getChainLabel(chainId: string): string {
  switch (chainId) {
    case "11155111":
      return "Sepolia";
    case "84532":
      return "Base Sepolia";
    case "97":
      return "BSC Testnet";
    default:
      return `Chain ${chainId}`;
  }
}

export function generateDemoPosts(args?: {
  seed?: number;
  totalCount?: number;
  chainIds?: string[];
  imagePostRatio?: number;
  featuredAuthor?: string | null;
  featuredCount?: number;
}): Post[] {
  const now = Math.floor(Date.now() / 1000);
  const seed = typeof args?.seed === "number" ? args.seed : Date.now();
  const totalCount = typeof args?.totalCount === "number" ? Math.max(1, Math.floor(args.totalCount)) : 14;
  const chainIds = (args?.chainIds?.length ? args.chainIds : Array.from(DEMO_CHAIN_IDS)).map(String);
  const imagePostRatio =
    typeof args?.imagePostRatio === "number" && Number.isFinite(args.imagePostRatio)
      ? Math.min(1, Math.max(0, args.imagePostRatio))
      : 0.65;

  const rand = mulberry32(seed);

  const featuredAuthor = typeof args?.featuredAuthor === "string" ? args.featuredAuthor.trim().toLowerCase() : "";
  const featuredCount = typeof args?.featuredCount === "number" ? Math.max(0, Math.floor(args.featuredCount)) : 2;

  const titleBits = [
    "Hello world",
    "On-chain thoughts",
    "Shipping fast",
    "Demo mode feed",
    "Minted as NFT",
    "Decentralized vibes",
    "Testing the waters",
    "This is a sample post",
    "Real image, fake post"
  ];
  const bodyBits = [
    "Connect + get approved to load the real subgraph feed.",
    "This content is auto-generated to avoid hitting The Graph limits.",
    "Refresh to regenerate images + text (demo only).",
    "Reactions are signatures; posts are NFTs.",
    "Built with Vite + React + Hardhat.",
    "Multi-chain feed preview while gated.",
    "Lorem ipsum, but make it web3.",
    "Trying a different image on refresh.",
    "Rate limits are real—demo data is cheap."
  ];

  const posts: Post[] = [];
  let globalIndex = 0;

  const counts: number[] = chainIds.map(() => 0);
  for (let i = 0; i < totalCount; i += 1) {
    counts[i % chainIds.length] += 1;
  }
  // Shuffle distribution slightly for variety, but keep total fixed.
  for (let i = counts.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = counts[i]!;
    counts[i] = counts[j]!;
    counts[j] = tmp;
  }

  for (let chainIndex = 0; chainIndex < chainIds.length; chainIndex += 1) {
    const chainId = chainIds[chainIndex]!;
    const chainLabel = getChainLabel(chainId);
    const count = counts[chainIndex] ?? 0;
    for (let i = 0; i < count; i += 1) {
      globalIndex += 1;
      const hasImage = rand() < imagePostRatio;
      const imageSeed = `${seed}-${chainId}-${i}-${Math.floor(rand() * 1e9)}`;
      const imageUrl = hasImage
        ? `https://picsum.photos/seed/${encodeURIComponent(imageSeed)}/900/600`
        : "";
      const title = `${pick(rand, titleBits)} · ${chainLabel}`;
      const body = `${pick(rand, bodyBits)} ${pick(rand, bodyBits)}`;
      const author = toHexAddress((seed + globalIndex * 2654435761) >>> 0);

      posts.push({
        tokenId: `demo-${seed}-${chainId}-${i}`,
        chainId,
        title,
        body,
        image: imageUrl,
        metadataURI: `demo://post/${seed}/${chainId}/${i}`,
        author,
        mintTimestamp: now - Math.floor(rand() * 60 * 60 * 24 * 7),
        likes: Math.floor(rand() * 250),
        comments: Math.floor(rand() * 25),
        saves: Math.floor(rand() * 40),
        tipsWei: 0n
      });
    }
  }

  // Newest first (roughly)
  posts.sort((a, b) => (b.mintTimestamp ?? 0) - (a.mintTimestamp ?? 0));

  if (featuredAuthor && featuredCount > 0) {
    // Force a couple of top posts to be authored by the connected wallet.
    // (Display name can be overlaid via authorIdentity.)
    for (let i = 0; i < Math.min(featuredCount, posts.length); i += 1) {
      const p = posts[i];
      if (!p) continue;
      p.author = featuredAuthor;
      if (typeof p.title === "string") {
        p.title = `Your post · ${getChainLabel(String(p.chainId ?? ""))}`;
      }
    }
  }

  return posts;
}
