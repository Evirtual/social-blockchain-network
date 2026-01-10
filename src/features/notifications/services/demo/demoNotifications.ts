import type { NotificationItem } from "../../types";
import { generateDemoPosts } from "@features/feed/services/demo/demoPosts";
import { generateDemoComments } from "@features/feed/services/demo/demoComments";
import { readSessionCache, writeSessionCache } from "@shared/lib/sessionCache";

function norm(s: string | null | undefined): string {
  return String(s ?? "").trim().toLowerCase();
}

function demoBaseTsKey(recipientAddress: string, chainId: string | null): string {
  const w = norm(recipientAddress);
  const c = norm(chainId);
  return `socialBlockchainNetwork.notifications.demo.baseTs.${c || "unknown"}.${w || "unknown"}`;
}

function getOrCreateDemoBaseTs(recipientAddress: string, chainId: string | null): number {
  const key = demoBaseTsKey(recipientAddress, chainId);
  const cached = readSessionCache<{ ts?: number }>(key);
  const ts = typeof cached?.ts === "number" ? cached.ts : 0;
  if (Number.isFinite(ts) && ts > 0) return ts;
  const now = Math.floor(Date.now() / 1000);
  writeSessionCache(key, { ts: now });
  return now;
}

export function buildDemoNotifications(recipientAddress: string, chainId: string | null): NotificationItem[] {
  const recipient = String(recipientAddress ?? "").trim().toLowerCase();
  const baseTs = getOrCreateDemoBaseTs(recipientAddress, chainId);

  const chainIdStr = String(chainId ?? "").trim();
  const chainIds = chainIdStr ? [chainIdStr] : undefined;
  const seed = 424242;
  const posts = generateDemoPosts({
    seed,
    totalCount: 6,
    chainIds,
    imagePostRatio: 0.5,
    featuredAuthor: recipient,
    featuredCount: 0
  });
  const postA = posts[0];
  const postB = posts[1] ?? posts[0];

  const tokenIdA = postA?.tokenId ?? `demo-${seed}-${chainIdStr || "11155111"}-0`;
  const chainIdA = postA?.chainId ?? (chainIdStr || null);
  const commentsA = generateDemoComments({ tokenId: tokenIdA, postChainId: chainIdA, count: 6, seed });
  const aC1 = commentsA[0]?.commentId ?? "1000001";

  const tokenIdB = postB?.tokenId ?? `demo-${seed}-${chainIdStr || "11155111"}-1`;
  const chainIdB = postB?.chainId ?? (chainIdStr || null);
  const commentsB = generateDemoComments({ tokenId: tokenIdB, postChainId: chainIdB, count: 6, seed: seed + 1 });
  const bC1 = commentsB[0]?.commentId ?? "2000001";
  const bC2 = commentsB[1]?.commentId ?? "2000002";

  const actor1 = {
    id: "0x1111111111111111111111111111111111111111",
    name: "Alice",
    avatar: null
  };
  const actor2 = {
    id: "0x2222222222222222222222222222222222222222",
    name: "Bob",
    avatar: null
  };
  const actor3 = {
    id: "0x3333333333333333333333333333333333333333",
    name: "Carol",
    avatar: null
  };

  const safeActors = [actor1, actor2, actor3].filter((a) => a.id.toLowerCase() !== recipient);
  const a1 = safeActors[0] ?? actor1;
  const a2 = safeActors[1] ?? actor2;
  const a3 = safeActors[2] ?? actor3;

  return [
    { id: "demo-0", kind: "FOLLOWED", tokenId: "0", chainId: chainIdA, commentId: null, timestamp: baseTs - 10, actor: a2 },
    { id: "demo-1", kind: "POST_LIKED", tokenId: tokenIdA, chainId: chainIdA, commentId: null, timestamp: baseTs - 20, actor: a1 },
    { id: "demo-2", kind: "POST_SAVED", tokenId: tokenIdB, chainId: chainIdB, commentId: null, timestamp: baseTs - 45, actor: a2 },
    { id: "demo-3", kind: "POST_COMMENTED", tokenId: tokenIdA, chainId: chainIdA, commentId: aC1, timestamp: baseTs - 80, actor: a3 },
    { id: "demo-4", kind: "COMMENT_LIKED", tokenId: tokenIdB, chainId: chainIdB, commentId: bC1, timestamp: baseTs - 120, actor: a2 },
    { id: "demo-5", kind: "COMMENT_SAVED", tokenId: tokenIdA, chainId: chainIdA, commentId: aC1, timestamp: baseTs - 180, actor: a1 },
    { id: "demo-6", kind: "COMMENT_REPLIED", tokenId: tokenIdB, chainId: chainIdB, commentId: bC2, timestamp: baseTs - 240, actor: a3 },
    { id: "demo-7", kind: "POST_FROZEN", tokenId: tokenIdB, chainId: chainIdB, commentId: null, timestamp: baseTs - 300, actor: a3 }
  ];
}
