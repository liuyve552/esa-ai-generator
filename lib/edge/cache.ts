type CacheEnvelope<T> = {
  expiresAt: number;
  value: T;
};

type MemEntry<T> = {
  expiresAt: number;
  value: T;
};

function getCache(): Cache | null {
  const anyGlobal = globalThis as any;
  const c = anyGlobal?.caches?.default as Cache | undefined;
  return c ?? null;
}

function getMem(): Map<string, MemEntry<unknown>> {
  const g = globalThis as any;
  if (!g.__EDGE_MEM_CACHE) g.__EDGE_MEM_CACHE = new Map<string, MemEntry<unknown>>();
  return g.__EDGE_MEM_CACHE as Map<string, MemEntry<unknown>>;
}

export async function edgeCacheGet<T>(keyUrl: string): Promise<{ hit: boolean; value?: T }> {
  const cache = getCache();
  if (cache) {
    const req = new Request(keyUrl, { method: "GET" });
    const res = await cache.match(req);
    if (!res) return { hit: false };
    try {
      const json = (await res.json()) as CacheEnvelope<T>;
      if (!json || typeof json.expiresAt !== "number") return { hit: false };
      if (Date.now() > json.expiresAt) return { hit: false };
      return { hit: true, value: json.value };
    } catch {
      return { hit: false };
    }
  }

  const mem = getMem();
  const entry = mem.get(keyUrl) as MemEntry<T> | undefined;
  if (!entry) return { hit: false };
  if (Date.now() > entry.expiresAt) return { hit: false };
  return { hit: true, value: entry.value };
}

export async function edgeCachePut<T>(keyUrl: string, value: T, ttlMs: number): Promise<void> {
  const cache = getCache();
  const expiresAt = Date.now() + ttlMs;

  if (cache) {
    const req = new Request(keyUrl, { method: "GET" });
    const envelope: CacheEnvelope<T> = { expiresAt, value };
    const ttlSeconds = Math.max(1, Math.round(ttlMs / 1000));
    const res = new Response(JSON.stringify(envelope), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": `public, max-age=0, s-maxage=${ttlSeconds}`
      }
    });
    await cache.put(req, res);
    return;
  }

  const mem = getMem();
  mem.set(keyUrl, { expiresAt, value } as MemEntry<unknown>);
}
