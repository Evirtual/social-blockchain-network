import { type Log, type EventLog } from "ethers";
import { getEnv, type EnvMap } from "./env";
import { getRpcWsProvider, getRpcWsUrlForChainId } from "./rpc";
import { resolveConfiguredSocialPostsAddress } from "./configuredSocialPostsAddress";
import { getSocialContract } from "@features/contract/contracts/socialPosts";
import type { SocialPostsContract } from "@features/contract/types";

type SocialEvent = {
  chainId: number;
  name: string;
  args: unknown[];
  log?: EventLog | Log;
};

type Subscriber = (event: SocialEvent) => void;

type ChainSubscription = {
  chainId: number;
  contract: SocialPostsContract;
  subscribers: Set<Subscriber>;
  handlers: Map<string, (...args: unknown[]) => void>;
  teardownTimer: ReturnType<typeof setTimeout> | null;
};

const SOCIAL_EVENT_NAMES = [
  "PostMinted",
  "PostUpdated",
  "PostUpdatedByAdmin",
  "PostEditedStatus",
  "PostFrozen",
  "PostBurned",
  "PostBurnedByAdmin",
  "PostLiked",
  "PostUnliked",
  "PostSaved",
  "PostUnsaved",
  "PostTipped",
  "CommentAdded",
  "CommentEdited",
  "CommentDeleted",
  "CommentLiked",
  "CommentUnliked",
  "CommentSaved",
  "CommentUnsaved",
  "CommentTipped",
  "Followed",
  "Unfollowed",
  "ProfileUpdated",
  "ProfileModerated",
  "ProfileClearedByAdmin",
  "PosterAllowed",
  "PosterApprovalRequested",
  "TipsWithdrawn"
] as const;

const chainSubscriptions = new Map<number, ChainSubscription>();

function normalizeChainIds(chainIds: number[]): number[] {
  const out = new Set<number>();
  for (const id of chainIds) {
    if (Number.isFinite(id)) out.add(id);
  }
  return Array.from(out);
}

export function isSocialEventsAvailable(chainIdNum: number | null, env: EnvMap = getEnv()): boolean {
  if (chainIdNum == null) return false;
  const wsUrl = getRpcWsUrlForChainId(env, chainIdNum);
  const contractAddress = resolveConfiguredSocialPostsAddress(chainIdNum, env);
  return Boolean(wsUrl && wsUrl.trim() && contractAddress && contractAddress.trim());
}

function ensureChainSubscription(chainId: number, env: EnvMap): ChainSubscription | null {
  const existing = chainSubscriptions.get(chainId);
  if (existing) {
    if (existing.teardownTimer) {
      clearTimeout(existing.teardownTimer);
      existing.teardownTimer = null;
    }
    return existing;
  }

  const wsUrl = getRpcWsUrlForChainId(env, chainId);
  const contractAddress = resolveConfiguredSocialPostsAddress(chainId, env);
  if (!wsUrl || !contractAddress) return null;

  const provider = getRpcWsProvider(wsUrl, chainId);
  const contract = getSocialContract(contractAddress, provider);
  const handlers = new Map<string, (...args: unknown[]) => void>();
  const subscribers = new Set<Subscriber>();

  for (const name of SOCIAL_EVENT_NAMES) {
    const handler = (...args: unknown[]) => {
      const last = args[args.length - 1] as EventLog | Log | undefined;
      const event: SocialEvent = { chainId, name, args, log: last };
      for (const subscriber of Array.from(subscribers)) {
        try {
          subscriber(event);
        } catch {
          // ignore subscriber errors
        }
      }
    };
    handlers.set(name, handler);
    contract.on(name, handler);
  }

  const sub: ChainSubscription = { chainId, contract, subscribers, handlers, teardownTimer: null };
  chainSubscriptions.set(chainId, sub);
  return sub;
}

function teardownChainSubscription(chainId: number, delayMs = 1500) {
  const sub = chainSubscriptions.get(chainId);
  if (!sub) return;
  if (sub.teardownTimer) return;
  sub.teardownTimer = setTimeout(() => {
    const current = chainSubscriptions.get(chainId);
    if (!current || current.subscribers.size > 0) return;
    for (const [name, handler] of current.handlers) {
      try {
        current.contract.off(name, handler);
      } catch {
        // ignore
      }
    }
    const runner = current.contract.runner as { destroy?: () => void } | null;
    try {
      runner?.destroy?.();
    } catch {
      // ignore
    }
    chainSubscriptions.delete(chainId);
  }, delayMs);
}

export function subscribeSocialEvents(args: {
  chainIds: number[];
  onEvent: Subscriber;
  env?: EnvMap;
}): () => void {
  const env = args.env ?? getEnv();
  const chainIds = normalizeChainIds(args.chainIds);
  const active: number[] = [];

  for (const chainId of chainIds) {
    const sub = ensureChainSubscription(chainId, env);
    if (!sub) continue;
    sub.subscribers.add(args.onEvent);
    active.push(chainId);
  }

  return () => {
    for (const chainId of active) {
      const sub = chainSubscriptions.get(chainId);
      if (!sub) continue;
      sub.subscribers.delete(args.onEvent);
      if (sub.subscribers.size === 0) {
        teardownChainSubscription(chainId);
      }
    }
  };
}
