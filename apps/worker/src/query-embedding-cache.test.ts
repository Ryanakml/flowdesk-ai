import { setTimeout as delay } from "node:timers/promises";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AiProviderError, type AiEmbeddingProvider } from "@flowdesk/providers";
import { getPrometheusMetrics, resetMetrics } from "@flowdesk/observability";
import {
  createQueryEmbeddingCache,
  type EmbeddingCacheStore,
  type QueryEmbeddingCacheOptions
} from "./query-embedding-cache.js";

function fixture(overrides: Partial<QueryEmbeddingCacheOptions> = {}) {
  const values = new Map<string, string>();
  const locks = new Map<string, string>();
  const store = {
    get: vi.fn((key: string) => Promise.resolve(values.get(key) ?? null)),
    acquire: vi.fn((key: string, token: string) => {
      if (locks.has(key)) return Promise.resolve(false);
      locks.set(key, token);
      return Promise.resolve(true);
    }),
    fill: vi.fn((key: string, token: string, value: string) => {
      if (locks.get(key) !== token) return Promise.resolve(false);
      values.set(key, value);
      return Promise.resolve(true);
    }),
    release: vi.fn((key: string, token: string) => {
      if (locks.get(key) === token) locks.delete(key);
      return Promise.resolve();
    })
  } satisfies EmbeddingCacheStore;
  const provider = {
    name: "test-provider",
    dimensions: 3,
    checkHealth: () =>
      Promise.resolve({ status: "available", checkedAt: new Date().toISOString() }),
    generateEmbeddings: vi.fn(() =>
      Promise.resolve([{ embedding: [0.1, 0.2, 0.3], tokenCount: 4 }])
    )
  } satisfies AiEmbeddingProvider;
  const options: QueryEmbeddingCacheOptions = {
    store,
    provider,
    environment: "test",
    providerIdentity: "provider:https://test.invalid",
    model: "model-1",
    namespace: "v1",
    ttlMs: 60_000,
    providerTimeoutMs: 1000,
    ...overrides
  };
  return { values, locks, store, provider, options, cache: createQueryEmbeddingCache(options) };
}

describe("query embedding cache", () => {
  beforeEach(resetMetrics);

  it("reuses exact input without sharing mutable vectors or logging tenant/input", async () => {
    const { cache, provider, values } = fixture();
    const first = await cache.generate("tenant-private", "redacted query");
    first[0] = 99;
    expect(await cache.generate("tenant-private", "redacted query")).toEqual([0.1, 0.2, 0.3]);
    expect(provider.generateEmbeddings).toHaveBeenCalledTimes(1);
    const serialized = JSON.stringify([...values]);
    expect(serialized).not.toContain("tenant-private");
    expect(serialized).not.toContain("redacted query");
    const metrics = getPrometheusMetrics();
    expect(metrics).toContain('query_embedding_cache_total{outcome="hit"} 1');
    expect(metrics).toContain('query_embedding_cache_total{outcome="provider_call"} 1');
    expect(metrics).not.toContain("tenant-private");
  });

  it("isolates tenants and preserves exact input identity", async () => {
    const { cache, provider } = fixture();
    await cache.generate("A", "Hello");
    await cache.generate("B", "Hello");
    await cache.generate("A", "hello");
    expect(provider.generateEmbeddings).toHaveBeenCalledTimes(3);
    await expect(cache.generate("", "Hello")).rejects.toThrow("tenant");
  });

  it("partitions key identity when embedding dimensions change", async () => {
    const { cache, options, values } = fixture();
    await cache.generate("A", "hello");
    const provider = {
      ...options.provider,
      dimensions: 2,
      generateEmbeddings: vi.fn(() => Promise.resolve([{ embedding: [1, 2], tokenCount: 4 }]))
    };
    expect(
      await createQueryEmbeddingCache({ ...options, provider }).generate("A", "hello")
    ).toEqual([1, 2]);
    expect(values.size).toBe(2);
  });

  it.each([
    { model: "model-2" },
    { providerIdentity: "provider:https://different.invalid" },
    { namespace: "v2" },
    { preprocessingVersion: "pii-v2" },
    { environment: "other" }
  ])("invalidates on identity change %j", async (change) => {
    const { cache, options, provider } = fixture();
    await cache.generate("A", "hello");
    await createQueryEmbeddingCache({ ...options, ...change }).generate("A", "hello");
    expect(provider.generateEmbeddings).toHaveBeenCalledTimes(2);
  });

  it.each(["json", "null", "dimension", "nonfinite", "identity", "expiry", "oversize"])(
    "treats corrupt %s entries as misses and replaces them",
    async (kind) => {
      const { cache, values, provider } = fixture();
      await cache.generate("A", "hello");
      const key = [...values.keys()][0]!;
      const entry = { key, embedding: [0.1, 0.2, 0.3], expiresAt: Date.now() + 60_000 };
      const corrupt =
        kind === "json"
          ? "{"
          : kind === "null"
            ? "null"
            : kind === "oversize"
              ? "x".repeat(65537)
              : JSON.stringify({
                  ...entry,
                  ...(kind === "dimension" ? { embedding: [1] } : {}),
                  ...(kind === "nonfinite" ? { embedding: [1, null, 3] } : {}),
                  ...(kind === "identity" ? { key: "another-tenant" } : {}),
                  ...(kind === "expiry" ? { expiresAt: 0 } : {})
                });
      values.set(key, corrupt);
      expect(await cache.generate("A", "hello")).toEqual(entry.embedding);
      expect(provider.generateEmbeddings).toHaveBeenCalledTimes(2);
      expect(getPrometheusMetrics()).toContain('outcome="invalid"');
    }
  );

  it("coalesces simultaneous requests and clears failed in-flight loads", async () => {
    const { cache, provider, values, locks } = fixture();
    const error = new AiProviderError("AI_PROVIDER_RATE_LIMITED");
    vi.mocked(provider.generateEmbeddings).mockRejectedValueOnce(error);
    const results = await Promise.allSettled(
      Array.from({ length: 20 }, () => cache.generate("A", "hello"))
    );
    expect(results.every((r) => r.status === "rejected" && r.reason === error)).toBe(true);
    expect(provider.generateEmbeddings).toHaveBeenCalledTimes(1);
    expect(values.size).toBe(0);
    expect(locks.size).toBe(0);
    await cache.generate("A", "hello");
    expect(provider.generateEmbeddings).toHaveBeenCalledTimes(2);
  });

  it("rejects invalid provider vectors without caching them", async () => {
    const { cache, provider, values } = fixture();
    vi.mocked(provider.generateEmbeddings).mockResolvedValue([
      { embedding: [1, NaN, 3], tokenCount: 1 }
    ]);
    await expect(cache.generate("A", "hello")).rejects.toMatchObject({
      code: "AI_PROVIDER_INVALID_RESPONSE"
    });
    expect(values.size).toBe(0);
  });

  it.each(["get", "acquire", "fill", "release"] as const)(
    "falls back without failing valid provider results on %s failure",
    async (method) => {
      const { cache, store, provider } = fixture();
      vi.mocked(store[method]).mockRejectedValue(new Error("Redis unavailable"));
      expect(await cache.generate("A", "hello")).toEqual([0.1, 0.2, 0.3]);
      expect(provider.generateEmbeddings).toHaveBeenCalledTimes(1);
      expect(getPrometheusMetrics()).toContain('outcome="error"');
    }
  );

  it("uses a fill completed by another worker while waiting for its lock", async () => {
    const { cache, options, provider } = fixture({ waitMs: 200 });
    vi.mocked(provider.generateEmbeddings).mockImplementation(async () => {
      await delay(25);
      return [{ embedding: [0.1, 0.2, 0.3], tokenCount: 4 }];
    });
    const second = createQueryEmbeddingCache(options);
    await Promise.all([cache.generate("A", "hello"), second.generate("A", "hello")]);
    expect(provider.generateEmbeddings).toHaveBeenCalledTimes(1);
  });

  it("bounds lock waiting and never fills or unlocks another worker's lock", async () => {
    const { cache, store } = fixture({ waitMs: 10 });
    vi.mocked(store.acquire).mockResolvedValue(false);
    expect(await cache.generate("A", "hello")).toEqual([0.1, 0.2, 0.3]);
    expect(store.fill).not.toHaveBeenCalled();
    expect(store.release).not.toHaveBeenCalled();
  });

  it("returns valid results when cache admission is full", async () => {
    const { cache, store } = fixture();
    vi.mocked(store.fill).mockResolvedValue(false);
    expect(await cache.generate("A", "hello")).toEqual([0.1, 0.2, 0.3]);
    expect(getPrometheusMetrics()).toContain('outcome="admission_rejected"');
  });
});
