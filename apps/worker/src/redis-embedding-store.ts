import { createClient } from "redis";
import type { EmbeddingCacheStore } from "./query-embedding-cache.js";

// Atomic admission bounds retained vectors across all worker instances/namespaces in an environment.
// The index tracks expiration, so crashed loaders and expired entries cannot consume capacity forever.
const FILL = `
if redis.call('GET', KEYS[2]) ~= ARGV[1] then return 0 end
local time = redis.call('TIME')
local now = time[1] * 1000 + math.floor(time[2] / 1000)
redis.call('ZREMRANGEBYSCORE', KEYS[3], '-inf', now)
if not redis.call('ZSCORE', KEYS[3], KEYS[1]) and redis.call('ZCARD', KEYS[3]) >= tonumber(ARGV[4]) then return 0 end
redis.call('ZADD', KEYS[3], now + tonumber(ARGV[3]), KEYS[1])
redis.call('SET', KEYS[1], ARGV[2], 'PX', ARGV[3])
return 1`;
const RELEASE = `
if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end
return 0`;

export interface RedisEmbeddingStoreOptions {
  url: string;
  environment: string;
  timeoutMs: number;
  maxEntries: number;
}

/** Dedicated disposable-cache connection. No Socket.IO subscriber connection or offline replay. */
export function createRedisEmbeddingStore(
  options: RedisEmbeddingStoreOptions
): EmbeddingCacheStore & {
  close(): void;
} {
  let client: ReturnType<typeof createClient> | undefined;
  let connecting: Promise<unknown> | undefined;
  let retryAt = 0;
  let closed = false;
  const index = `fd:${options.environment}:query-embedding:v1:entries`;

  async function command(args: string[]): Promise<unknown> {
    if (closed || Date.now() < retryAt) throw new Error("Embedding cache unavailable");
    if (!client) {
      client = createClient({
        url: options.url,
        disableOfflineQueue: true,
        commandsQueueMaxLength: 128,
        socket: { connectTimeout: options.timeoutMs, reconnectStrategy: false }
      });
      client.on("error", () => {
        /* command failures are counted by the cache; never log secrets */
      });
      connecting = client.connect();
    }
    const current = client;
    const controller = new AbortController();
    let timer: NodeJS.Timeout | undefined;
    const expired = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new Error("Embedding cache deadline exceeded"));
      }, options.timeoutMs);
    });
    try {
      return await Promise.race([
        (async () => {
          await connecting;
          return current.sendCommand(args, { abortSignal: controller.signal });
        })(),
        expired
      ]);
    } catch {
      // Also destroy the socket: abort alone only cancels commands not yet sent by node-redis.
      // This bounds outstanding responses when Redis accepts TCP but stops replying.
      if (current.isOpen) current.destroy();
      if (client === current) {
        client = undefined;
        connecting = undefined;
        retryAt = Date.now() + 5_000;
      }
      throw new Error("Embedding cache unavailable");
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    async get(key) {
      const result = await command(["GET", key]);
      return typeof result === "string" ? result : null;
    },
    async acquire(key, token, leaseMs) {
      return (await command(["SET", `${key}:lock`, token, "NX", "PX", String(leaseMs)])) === "OK";
    },
    async fill(key, token, value, ttlMs) {
      return (
        (await command([
          "EVAL",
          FILL,
          "3",
          key,
          `${key}:lock`,
          index,
          token,
          value,
          String(ttlMs),
          String(options.maxEntries)
        ])) === 1
      );
    },
    async release(key, token) {
      await command(["EVAL", RELEASE, "1", `${key}:lock`, token]);
    },
    close() {
      closed = true;
      if (client?.isOpen) client.destroy();
    }
  };
}
