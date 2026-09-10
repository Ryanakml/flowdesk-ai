# Query embedding cache

Tracking: [#257](https://github.com/Ryanakml/flowdesk-ai/issues/257), M0 Execution foundation; M4 draft worker consumer.

## Behavior and scope

The worker optionally caches the vector for the exact query **after** existing prompt-injection screening and PII redaction. The cache receives the tenant explicitly. A successful hit avoids an embedding provider request; vector search, citations, chat generation, knowledge-version rechecks, and send guards still run. Document ingestion does not use this cache.

This is an embedding result cache, not a cache of answers or retrieved knowledge. Different wording does not receive semantic matching. Source/job deduplication remains in PostgreSQL. No provider token usage or monetary saving is fabricated for cache hits.

Implementation is worker-local because only the draft worker consumes this cache. `query-embedding-cache.ts` owns identity, validation, single-flight, and fallback; `redis-embedding-store.ts` owns Redis I/O and atomic admission/lock scripts. Extract a shared package only when another consumer actually needs it.

## Configuration

| Worker setting                      | Default | Purpose                                                                 |
| ----------------------------------- | ------- | ----------------------------------------------------------------------- |
| `QUERY_EMBEDDING_CACHE_ENABLED`     | `false` | Opt-in; requires a valid `REDIS_URL` when true                          |
| `QUERY_EMBEDDING_CACHE_NAMESPACE`   | `v1`    | Manual invalidation/model deployment epoch; letters, digits, `_`, `-`   |
| `QUERY_EMBEDDING_CACHE_TTL_SECONDS` | `86400` | Entry lifetime, with ±10% jitter; configured range 1–604800             |
| `QUERY_EMBEDDING_CACHE_TIMEOUT_MS`  | `100`   | Per Redis operation deadline including connection; range 10–1000        |
| `QUERY_EMBEDDING_CACHE_MAX_ENTRIES` | `1000`  | Shared admission ceiling per environment, across workers and namespaces |
| `REDIS_URL`                         | absent  | Existing private Redis; `redis://` or `rediss://`                       |

Compose passes cache settings only through the worker AI environment. Existing deployments remain disabled without an environment change. The worker opens its own lazy connection and destroys it during shutdown. AI disabled means no cache is created. Cache availability does not change liveness/readiness semantics.

## Identity, expiry, and invalidation

Keys have this structure:

```text
fd:<environment>:query-embedding:v1:<tenantDigest>:<identityDigest>:<inputDigest>
```

Identity includes provider kind/base URL, model, dimensions, namespace, preprocessing version (`pii-v1`), and query purpose. Hashing exact input preserves case and punctuation. Tenant digests prevent sharing even when two tenants send identical text. Values contain only the expected key, vector, and absolute expiry. They never contain the input query or provider credentials. Redis is still tenant-sensitive storage: vectors are derived data, and AOF may persist them.

Text/model/base URL/dimension/preprocessor changes select another key. Bump the namespace when redeploying a mutable model alias or changing preprocessing semantics. Old entries expire naturally; there is no bulk key deletion during deployment. Model changes also require compatible document vectors in PostgreSQL; cache invalidation does not replace re-embedding.

Knowledge changes do not invalidate query embeddings: the vector depends on input and embedding configuration, not on the knowledge corpus. Knowledge-version safety stays in the existing worker. There is no retrieval cache in this implementation.

Reads validate payload size, exact key identity, dimension count, finite coordinates, and expiry. Invalid data is treated as a miss and replaced only after a successful provider call. Requests receive vector copies so one caller cannot mutate another caller's in-flight result.

## Failure and concurrency contract

- Cache GET/connect/lock failures fall back to the existing provider. Successful provider results survive cache fill/release failure. Provider errors keep their original classification and retry behavior; invalid vectors/errors are not cached.
- Offline command queuing is disabled. A hard deadline aborts queued commands and destroys the connection, also bounding commands already sent but still awaiting replies. Redis failures open a five-second cooldown; the next eligible request then reconnects. A command already executed by Redis cannot be undone, but fill/release operations are ownership checked and cache values are disposable.
- Same-process requests for the same identity share one in-flight promise. Bookkeeping is bounded to 128 identities; overflow uses the original provider path.
- Cross-worker misses use a unique ownership token and a lease equal to the configured provider timeout plus two seconds. Losers poll for at most one second, then fall back without filling or releasing another loader's lock. Poll commands retain their own deadline, so the total wait can include the final command deadline.
- Lease expiry or a slow provider can produce duplicate computation; this is load reduction, not exactly-once execution. Existing worker batch scheduling continues to bound ordinary provider work. No new unbounded background warming or retry loop is introduced.
- A post-acquisition read avoids recomputing a value filled between the initial GET and acquiring a released lock.

## Capacity and Redis topology

Each cached value is capped at 64 KiB. Atomic Lua admission limits retained vectors to `MAX_ENTRIES` across namespaces and tenants in an environment. At the default 1000 this bounds serialized vector values to roughly 62.5 MiB, plus keys, the expiry index, locks, Redis allocator overhead, and AOF overhead. Actual 1536-dimensional JSON vectors usually use less than the value cap; measure on the deployment.

The shared sorted-set expiry index is reserved before SET so a failed write can leave only an expiring reservation, not an untracked vector. Expired reservations are removed during subsequent fills. Index metadata is bounded by admitted entries, though stale metadata can remain while no fills occur. A full cache serves uncached provider results until entries expire. Namespace rotation does not bypass the capacity ceiling; old entries may temporarily consume the budget. Use the same limit on all workers; lower limits stop new admission but do not immediately delete existing entries.

The implementation targets the existing standalone Redis, not Redis Cluster: admission uses a shared environment index and multi-key scripts. Do not enable an eviction policy that can independently remove the capacity index while retaining vectors. Keep existing `noeviction`; review total host headroom/maxmemory and realtime usage before enabling. Admission bounds this cache's contribution, not total Redis memory. Cache write rejection safely bypasses storage.

No new Redis instance or eviction policy is deployed by this PR. Do not use `FLUSHALL` to invalidate embeddings on the shared service. For tenant deletion, derive the tenant digest and remove only that tenant's cache/lock keys with bounded SCAN/UNLINK, and remove matching members from the environment index under the existing data-deletion operating procedure. Expiry is not a substitute for a required immediate deletion.

## Metrics and acceptance

Worker `/metrics` exposes:

- `query_embedding_cache_total{outcome}`: `hit`, `miss`, `coalesced`, `lock_wait`, `bypass`, `invalid`, `error`, `admission_rejected`, and actual `provider_call`.
- `query_embedding_duration_seconds_{count,sum}{stage}`: lookup and provider durations.

These are decision counters, not mutually exclusive request outcomes: a miss can later hit while waiting. Do not divide all outcomes to invent a hit rate. Use actual provider-call reductions against eligible query invocations and report coalescing separately. Labels never include tenant IDs, keys, queries, or vectors. Existing AI draft metrics provide end-to-end duration; measure percentiles from a representative benchmark/trace set rather than treating summary averages as p95.

After merge-triggered deployment, record the exact build SHA and follow this acceptance sequence in a test tenant:

1. Enable the cache for the worker with a reviewed memory budget and namespace. Confirm `queryEmbeddingCacheEnabled` in the worker startup log.
2. Trigger an eligible draft through the existing workflow; record provider_call/miss deltas and a grounded draft.
3. Trigger another eligible run with identical redacted input in the same tenant; confirm embedding hit and no additional embedding provider call. Retrieval and chat must still execute.
4. Repeat in another tenant and with changed input/namespace; confirm a miss rather than cross-tenant reuse.
5. In an isolated environment, expire/corrupt a key and interrupt Redis; verify provider fallback, bounded latency, and recovery. Do not interrupt shared staging realtime for this drill.
6. Compare cache-off/on cold, warm, and mixed workloads; record provider calls, total latency, memory, and errors. Synthetic repeated FAQ traffic is not proof of production hit rate or cost savings.

Rollback: set `QUERY_EMBEDDING_CACHE_ENABLED=false` through the existing environment/deployment workflow. The original provider path resumes and existing cache keys expire. No schema migration or database rollback is needed.

## Local and CI verification

The integration suite changes `maxmemory` and briefly pauses Redis to exercise real failures. **Use a disposable test server only**, never a production/staging `REDIS_URL`. It uses a dedicated `REDIS_TEST_URL` and random key namespace.

```bash
docker run -d --name flowdesk-cache-test -p 127.0.0.1:16379:6379 \
  redis:7.4.2-bookworm redis-server --save '' --appendonly no
pnpm turbo run build --filter=@flowdesk/worker...
RUN_REDIS_INTEGRATION=true REDIS_TEST_URL=redis://127.0.0.1:16379 \
  pnpm --filter @flowdesk/worker exec vitest run src/query-embedding-cache.redis.test.ts
docker rm -f flowdesk-cache-test
```

Normal unit tests skip this opt-in suite. The required `database-foundation` CI job provisions real Redis and explicitly enables it; missing test URL is a hard failure. Unit/worker tests cover key invalidation, redaction placement, safety parity, corrupted values, provider failures, and store failures. Real Redis tests cover shared hits, concurrent loaders, expiry, admission, lock ownership, memory rejection, stalled TCP, cooldown, and reconnection.

Source and CI evidence belong in the implementation PR. Real-provider staging savings remain a separate acceptance level until measured.
