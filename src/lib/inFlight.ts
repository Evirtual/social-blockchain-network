export type InFlightMap<T> = Record<string, Promise<T> | null>;

export async function runInFlight<T>(
  map: InFlightMap<T>,
  key: string,
  factory: () => Promise<T>
): Promise<T> {
  const existing = map[key];
  if (existing) return await existing;

  // Ensure `factory` starts async even if it throws synchronously.
  const task = Promise.resolve().then(factory);
  map[key] = task;
  try {
    return await task;
  } finally {
    if (map[key] === task) map[key] = null;
  }
}
