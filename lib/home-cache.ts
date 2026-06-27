const cache = new Map<string, { data: unknown; ts: number }>();
const TTL = 60_000;

export function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > TTL) { cache.delete(key); return null; }
  return entry.data as T;
}

export function setCached(key: string, data: unknown) {
  cache.set(key, { data, ts: Date.now() });
}

export function invalidateCache(key: string) {
  cache.delete(key);
}
