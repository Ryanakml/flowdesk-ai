import { randomUUID } from "node:crypto";
import { createServer, type Socket } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import { createClient } from "redis";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { FakeEmbeddingProvider } from "@flowdesk/providers";
import { createQueryEmbeddingCache } from "./query-embedding-cache.js";
import { createRedisEmbeddingStore } from "./redis-embedding-store.js";

const enabled = process.env["RUN_REDIS_INTEGRATION"] === "true";
const url = process.env["REDIS_TEST_URL"];
if (enabled && !url) throw new Error("REDIS_TEST_URL is required for the Redis integration gate");

describe.skipIf(!enabled)("query embedding cache with real Redis", () => {
  const environment = `test-${randomUUID()}`;
  const prefix = `fd:${environment}:query-embedding:v1`;
  const admin = createClient({
    url: url ?? "redis://127.0.0.1:16379",
    socket: { reconnectStrategy: false }
  });
  admin.on("error", () => {});
  const stores: Array<ReturnType<typeof createRedisEmbeddingStore>> = [];
  function store(maxEntries = 1000, timeoutMs = 1000, storeUrl = url!) {
    const result = createRedisEmbeddingStore({ url: storeUrl, environment, timeoutMs, maxEntries });
    stores.push(result);
    return result;
  }
  function cache(redis = store(), provider = new FakeEmbeddingProvider(), namespace = "v1") {
    return createQueryEmbeddingCache({
      store: redis,
      provider,
      environment,
      providerIdentity: "fake",
      model: "fake-1536",
      namespace,
      ttlMs: 60_000,
      providerTimeoutMs: 1000
    });
  }
  beforeAll(async () => {
    await admin.connect();
  });
  afterEach(async () => {
    stores.splice(0).forEach((item) => item.close());
    // This suite requires a disposable Redis. Only remove this suite's random namespace.
    const keys = await admin.keys(`${prefix}:*`);
    if (keys.length) await admin.del(keys);
  });
  afterAll(() => {
    admin.destroy();
  });

  it("shares successful vectors across worker connections, with tenant and namespace isolation", async () => {
    const provider = new FakeEmbeddingProvider();
    const spy = vi.spyOn(provider, "generateEmbeddings");
    const firstStore = store();
    const first = cache(firstStore, provider);
    const second = cache(store(), provider);
    const vector = await first.generate("tenant-a", "Jam buka?");
    expect(await second.generate("tenant-a", "Jam buka?")).toEqual(vector);
    expect(spy).toHaveBeenCalledTimes(1);
    firstStore.close();
    expect(await cache(store(), provider).generate("tenant-a", "Jam buka?")).toEqual(vector);
    expect(spy).toHaveBeenCalledTimes(1);
    await second.generate("tenant-b", "Jam buka?");
    await cache(store(), provider, "v2").generate("tenant-a", "Jam buka?");
    expect(spy).toHaveBeenCalledTimes(3);
    const keys = (await admin.keys(`${prefix}:*`)).filter((key) => !key.endsWith(":entries"));
    for (const key of keys) expect(await admin.pTTL(key)).toBeGreaterThan(0);
  });

  it("coalesces concurrent misses across separate Redis connections", async () => {
    const provider = new FakeEmbeddingProvider();
    const original = provider.generateEmbeddings.bind(provider);
    const spy = vi.spyOn(provider, "generateEmbeddings").mockImplementation(async (texts) => {
      await delay(100);
      return original(texts);
    });
    const workers = Array.from({ length: 3 }, () => cache(store(), provider));
    const results = await Promise.all(workers.map((worker) => worker.generate("A", "hello")));
    expect(results.every((value) => JSON.stringify(value) === JSON.stringify(results[0]))).toBe(
      true
    );
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("enforces admission atomically and recovers capacity after expiry", async () => {
    const first = store(1);
    const second = store(1);
    const keyA = `${prefix}:A`;
    const keyB = `${prefix}:B`;
    await first.acquire(keyA, "one", 1000);
    await second.acquire(keyB, "two", 1000);
    const admitted = await Promise.all([
      first.fill(keyA, "one", "value", 500),
      second.fill(keyB, "two", "value", 500)
    ]);
    expect(admitted.filter(Boolean)).toHaveLength(1);
    await delay(600);
    expect(await first.get(keyA)).toBeNull();
    expect(await second.get(keyB)).toBeNull();
    expect(await second.fill(keyB, "two", "new-value", 100)).toBe(true);
  });

  it("does not release or fill with an expired lock owner's token", async () => {
    const redis = store();
    const key = `${prefix}:lease`;
    expect(await redis.acquire(key, "old", 50)).toBe(true);
    await delay(100);
    expect(await redis.acquire(key, "new", 1000)).toBe(true);
    await redis.release(key, "old");
    expect(await admin.get(`${key}:lock`)).toBe("new");
    expect(await redis.fill(key, "old", "stale", 1000)).toBe(false);
    expect(await redis.fill(key, "new", "fresh", 1000)).toBe(true);
  });

  it("replaces a corrupt payload and misses after explicit key expiry", async () => {
    const provider = new FakeEmbeddingProvider();
    const spy = vi.spyOn(provider, "generateEmbeddings");
    const worker = cache(store(), provider);
    await worker.generate("A", "hello");
    const key = (await admin.keys(`${prefix}:*`)).find((value) => !value.endsWith(":entries"))!;
    await admin.set(key, "broken", { PX: 1000 });
    await worker.generate("A", "hello");
    await admin.pExpire(key, 1);
    await delay(10);
    await worker.generate("A", "hello");
    expect(spy).toHaveBeenCalledTimes(3);
  });

  it("falls back when Redis rejects writes under memory pressure", async () => {
    const before = await admin.configGet("maxmemory");
    try {
      await admin.configSet("maxmemory", "1");
      const provider = new FakeEmbeddingProvider();
      const spy = vi.spyOn(provider, "generateEmbeddings");
      expect(await cache(store(), provider).generate("A", "hello")).toHaveLength(1536);
      expect(spy).toHaveBeenCalledTimes(1);
    } finally {
      await admin.configSet("maxmemory", before["maxmemory"]!);
    }
  });

  it("bounds a stalled Redis connection and closes its socket instead of replaying commands", async () => {
    const sockets = new Set<Socket>();
    const blackhole = createServer((socket) => {
      sockets.add(socket);
      socket.on("data", () => {});
      socket.on("close", () => sockets.delete(socket));
    });
    await new Promise<void>((resolve) => blackhole.listen(0, "127.0.0.1", resolve));
    const address = blackhole.address();
    if (!address || typeof address === "string") throw new Error("Missing TCP test port");
    try {
      const redis = store(1000, 50, `redis://127.0.0.1:${address.port}`);
      const started = performance.now();
      expect(await cache(redis).generate("A", "hello")).toHaveLength(1536);
      expect(performance.now() - started).toBeLessThan(1000);
      await delay(25);
      expect(sockets.size).toBe(0);
      expect(await cache(redis).generate("A", "hello")).toHaveLength(1536);
    } finally {
      sockets.forEach((socket) => socket.destroy());
      await new Promise<void>((resolve) => blackhole.close(() => resolve()));
    }
  });

  it("recovers after a command stalls and the circuit cooldown elapses", async () => {
    const redis = store(1000, 250);
    const key = `${prefix}:recovery`;
    await redis.get(key);
    await admin.sendCommand(["CLIENT", "PAUSE", "600", "ALL"]);
    await expect(redis.get(key)).rejects.toThrow("unavailable");
    await delay(5500);
    expect(await redis.acquire(key, "token", 1000)).toBe(true);
    expect(await redis.fill(key, "token", "value", 1000)).toBe(true);
    expect(await redis.get(key)).toBe("value");
  }, 10_000);
});
