import { createHash, randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { AiProviderError, type AiEmbeddingProvider } from "@flowdesk/providers";
import { recordQueryEmbeddingCache, recordQueryEmbeddingDuration } from "@flowdesk/observability";

export interface EmbeddingCacheStore {
  get(key: string): Promise<string | null>;
  acquire(key: string, token: string, leaseMs: number): Promise<boolean>;
  fill(key: string, token: string, value: string, ttlMs: number): Promise<boolean>;
  release(key: string, token: string): Promise<void>;
}

export interface QueryEmbeddingCacheOptions {
  store: EmbeddingCacheStore;
  provider: AiEmbeddingProvider;
  environment: string;
  providerIdentity: string;
  model: string;
  namespace: string;
  preprocessingVersion?: string;
  ttlMs: number;
  providerTimeoutMs: number;
  waitMs?: number;
}

export interface QueryEmbeddingCache {
  generate(organizationId: string, redactedInput: string): Promise<number[]>;
}

const digest = (value: string) => createHash("sha256").update(value).digest("hex");
export const MAX_EMBEDDING_CACHE_BYTES = 64 * 1024;

/** Query-only cache. The caller must run injection screening and PII redaction first. */
export function createQueryEmbeddingCache(
  options: QueryEmbeddingCacheOptions
): QueryEmbeddingCache {
  const inFlight = new Map<string, Promise<number[]>>();
  const identity = digest(
    JSON.stringify([
      options.providerIdentity,
      options.model,
      options.provider.dimensions,
      options.namespace,
      options.preprocessingVersion ?? "pii-v1",
      "query"
    ])
  );
  const prefix = `fd:${options.environment}:query-embedding:v1`;

  function validVector(value: unknown): value is number[] {
    return (
      Array.isArray(value) &&
      value.length === options.provider.dimensions &&
      value.every((item: unknown) => typeof item === "number" && Number.isFinite(item))
    );
  }

  async function read(key: string): Promise<number[] | null> {
    const raw = await options.store.get(key);
    if (raw === null) return null;
    try {
      if (Buffer.byteLength(raw) > MAX_EMBEDDING_CACHE_BYTES) throw new Error("oversized");
      const entry = JSON.parse(raw) as Record<string, unknown>;
      if (
        entry["key"] === key &&
        typeof entry["expiresAt"] === "number" &&
        entry["expiresAt"] > Date.now() &&
        validVector(entry["embedding"])
      ) {
        return entry["embedding"];
      }
    } catch {
      // Treat malformed/oversized cache data as a miss, never as a provider failure.
    }
    recordQueryEmbeddingCache("invalid");
    return null;
  }

  async function generate(input: string): Promise<number[]> {
    recordQueryEmbeddingCache("provider_call");
    const started = performance.now();
    try {
      const result = await options.provider.generateEmbeddings([input]);
      if (result.length !== 1 || !validVector(result[0]?.embedding)) {
        throw new AiProviderError("AI_PROVIDER_INVALID_RESPONSE");
      }
      return result[0].embedding;
    } finally {
      recordQueryEmbeddingDuration("provider", (performance.now() - started) / 1000);
    }
  }

  async function load(key: string, input: string): Promise<number[]> {
    const started = performance.now();
    const token = randomUUID();
    let acquired = false;
    try {
      try {
        const cached = await read(key);
        if (cached) {
          recordQueryEmbeddingCache("hit");
          return cached;
        }
        recordQueryEmbeddingCache("miss");
        acquired = await options.store.acquire(key, token, options.providerTimeoutMs + 2_000);
        if (acquired) {
          // Another loader may have filled between our GET and lock acquisition.
          const filled = await read(key);
          if (filled) {
            recordQueryEmbeddingCache("hit");
            return filled;
          }
        } else {
          recordQueryEmbeddingCache("lock_wait");
          const deadline = Date.now() + (options.waitMs ?? 1_000);
          while (Date.now() < deadline) {
            await delay(Math.min(50, Math.max(1, deadline - Date.now())));
            const filled = await read(key);
            if (filled) {
              recordQueryEmbeddingCache("hit");
              return filled;
            }
          }
          recordQueryEmbeddingCache("bypass");
        }
      } catch {
        recordQueryEmbeddingCache("error");
        recordQueryEmbeddingCache("bypass");
      } finally {
        recordQueryEmbeddingDuration("lookup", (performance.now() - started) / 1000);
      }

      // Provider failures retain their original retry classification and are never cached.
      const embedding = await generate(input);
      if (acquired) {
        const ttlMs = Math.max(1, Math.round(options.ttlMs * (0.9 + Math.random() * 0.2)));
        const value = JSON.stringify({ key, embedding, expiresAt: Date.now() + ttlMs });
        if (Buffer.byteLength(value) <= MAX_EMBEDDING_CACHE_BYTES) {
          try {
            if (!(await options.store.fill(key, token, value, ttlMs))) {
              recordQueryEmbeddingCache("admission_rejected");
            }
          } catch {
            recordQueryEmbeddingCache("error");
          }
        } else {
          recordQueryEmbeddingCache("admission_rejected");
        }
      }
      return embedding;
    } finally {
      if (acquired) {
        try {
          await options.store.release(key, token);
        } catch {
          recordQueryEmbeddingCache("error");
        }
      }
    }
  }

  return {
    async generate(organizationId, input) {
      if (!organizationId) throw new Error("Query embedding cache requires a tenant");
      const key = `${prefix}:${digest(organizationId)}:${identity}:${digest(input)}`;
      const existing = inFlight.get(key);
      if (existing) {
        recordQueryEmbeddingCache("coalesced");
        return [...(await existing)];
      }
      // Bound bookkeeping during unusual concurrency; overflow uses the existing provider path.
      if (inFlight.size >= 128) {
        recordQueryEmbeddingCache("bypass");
        return generate(input);
      }
      const pending = load(key, input);
      inFlight.set(key, pending);
      try {
        return [...(await pending)];
      } finally {
        inFlight.delete(key);
      }
    }
  };
}
