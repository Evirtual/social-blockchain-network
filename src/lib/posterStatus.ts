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

export async function fetchPosterStatuses(readContract: any, addresses: string[]): Promise<PosterStatus[]> {
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
        const allowed = (await (readContract as any).isPosterAllowed(a)) as boolean;
        const disapprovedEver = (await (readContract as any).wasPosterDisapproved(a)) as boolean;
        return { address: a, allowed: !!allowed, disapprovedEver: !!disapprovedEver };
      } catch {
        return { address: a, allowed: false, disapprovedEver: false };
      }
    })
  );

  return checks;
}

export async function fetchPosterGateStatuses(readContract: any, addresses: string[]): Promise<PosterGateStatus[]> {
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
        const allowed = (await (readContract as any).isPosterAllowed(a)) as boolean;
        const requested = (await (readContract as any).hasPosterRequested(a)) as boolean;
        return { address: a, allowed: !!allowed, requested: !!requested };
      } catch {
        return { address: a, allowed: false, requested: false };
      }
    })
  );

  return checks;
}
