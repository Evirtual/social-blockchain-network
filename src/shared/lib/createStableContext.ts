export function createStableContext<T>(key: string, create: () => T): T {
  type GlobalStore = typeof globalThis & Record<string, T | undefined>;
  const store = globalThis as GlobalStore;
  const existing = store[key];
  if (existing) return existing;
  const created = create();
  store[key] = created;
  return created;
}
