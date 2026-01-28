export type AsyncCacheOptions = {
  defaultTtlMs: number;
  maxEntries: number;
};

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

export type AsyncCacheStats = {
  cacheSize: number;
  inflightSize: number;
};

export type AsyncRequestCache<T> = {
  getOrCreate: (key: string, factory: () => Promise<T>, ttlMs?: number) => Promise<T>;
  clear: () => void;
  prune: () => void;
  stats: () => AsyncCacheStats;
};

export function createAsyncRequestCache<T>(options: AsyncCacheOptions): AsyncRequestCache<T> {
  const cache = new Map<string, CacheEntry<T>>();
  const inflight = new Map<string, Promise<T>>();

  const prune = () => {
    const now = Date.now();
    for (const [key, entry] of cache) {
      if (entry.expiresAt <= now) cache.delete(key);
    }

    if (cache.size > options.maxEntries) {
      const toDelete = cache.size - options.maxEntries;
      let deleted = 0;
      for (const key of cache.keys()) {
        cache.delete(key);
        deleted += 1;
        if (deleted >= toDelete) break;
      }
    }
  };

  const getOrCreate = (key: string, factory: () => Promise<T>, ttlMs?: number): Promise<T> => {
    prune();

    const cached = cache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return Promise.resolve(cached.value);
    }

    const existing = inflight.get(key);
    if (existing) return existing;

    const promise = (async () => {
      try {
        const value = await factory();
        cache.set(key, { value, expiresAt: Date.now() + (ttlMs ?? options.defaultTtlMs) });
        prune();
        return value;
      } finally {
        inflight.delete(key);
      }
    })();

    inflight.set(key, promise);
    return promise;
  };

  const clear = () => {
    cache.clear();
    inflight.clear();
  };

  const stats = (): AsyncCacheStats => ({ cacheSize: cache.size, inflightSize: inflight.size });

  return { getOrCreate, clear, prune, stats };
}
