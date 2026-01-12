export type PosterStatus = {
  address: string;
  allowed: boolean;
  disapprovedEver: boolean;
};

export type PosterGateStatus = {
  address: string;
  allowed: boolean;
  requested: boolean;
};

export type ModeratorStatus = {
  address: string;
  moderator: boolean;
};

import type { Contract } from "ethers";

export async function fetchPosterStatuses(readContract: Contract, addresses: string[]): Promise<PosterStatus[]> {
  const uniqByKey = new Map<string, string>();
  for (const a of addresses) {
    const raw = (a ?? "").trim();
    if (!raw) continue;
    const key = raw.toLowerCase();
    if (!uniqByKey.has(key)) uniqByKey.set(key, raw);
  }

  const uniq = Array.from(uniqByKey.values());
  if (uniq.length === 0) return [];

  const checks = await Promise.all(
    uniq.map(async (a) => {
      try {
        const allowed = (await readContract.isPosterAllowed(a)) as boolean;
        const disapprovedEver = (await readContract.wasPosterDisapproved(a)) as boolean;
        return { address: a, allowed: !!allowed, disapprovedEver: !!disapprovedEver };
      } catch {
        return { address: a, allowed: false, disapprovedEver: false };
      }
    })
  );

  return checks;
}

export async function fetchPosterGateStatuses(readContract: Contract, addresses: string[]): Promise<PosterGateStatus[]> {
  const uniqByKey = new Map<string, string>();
  for (const a of addresses) {
    const raw = (a ?? "").trim();
    if (!raw) continue;
    const key = raw.toLowerCase();
    if (!uniqByKey.has(key)) uniqByKey.set(key, raw);
  }

  const uniq = Array.from(uniqByKey.values());
  if (uniq.length === 0) return [];

  const checks = await Promise.all(
    uniq.map(async (a) => {
      try {
        const allowed = (await readContract.isPosterAllowed(a)) as boolean;
        const requested = (await readContract.hasPosterRequested(a)) as boolean;
        return { address: a, allowed: !!allowed, requested: !!requested };
      } catch {
        return { address: a, allowed: false, requested: false };
      }
    })
  );

  return checks;
}

export async function fetchModeratorStatuses(readContract: Contract, addresses: string[]): Promise<ModeratorStatus[]> {
  const uniqByKey = new Map<string, string>();
  for (const a of addresses) {
    const raw = (a ?? "").trim();
    if (!raw) continue;
    const key = raw.toLowerCase();
    if (!uniqByKey.has(key)) uniqByKey.set(key, raw);
  }

  const uniq = Array.from(uniqByKey.values());
  if (uniq.length === 0) return [];

  const checks = await Promise.all(
    uniq.map(async (a) => {
      try {
        const moderator = (await (readContract as any).isModerator(a)) as boolean;
        return { address: a, moderator: !!moderator };
      } catch {
        return { address: a, moderator: false };
      }
    })
  );

  return checks;
}
