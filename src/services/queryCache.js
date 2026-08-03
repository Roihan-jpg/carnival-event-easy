export function createQueryCache({ ttlMs = 30_000, now = () => Date.now() } = {}) {
  const entries = new Map();

  async function query(key, loader) {
    const cached = entries.get(key);
    if (cached?.promise) return cached.promise;
    if (cached && cached.expiresAt > now()) return cached.value;

    const promise = Promise.resolve().then(loader);
    entries.set(key, { promise, expiresAt: 0 });

    try {
      const value = await promise;
      if (entries.get(key)?.promise === promise) {
        entries.set(key, { value, expiresAt: now() + ttlMs });
      }
      return value;
    } catch (error) {
      if (entries.get(key)?.promise === promise) entries.delete(key);
      throw error;
    }
  }

  function invalidate(prefix = '') {
    for (const key of entries.keys()) {
      if (key.startsWith(prefix)) entries.delete(key);
    }
  }

  return {
    query,
    invalidate,
    clear: () => entries.clear(),
  };
}
