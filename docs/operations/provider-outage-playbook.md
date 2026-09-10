# FlowDesk Provider Outage & Degraded Mode Playbook

This playbook outlines recovery procedures, safe-mode transitions, and mitigation tactics when external providers (Meta WhatsApp Cloud API, Google Gemini AI, PostgreSQL, Redis) experience degradation, rate limiting, or total outages.

---

## 1. Meta WhatsApp Cloud API Outages

### Scenario A: HTTP 429 (Rate Limit Exceeded)

- **Symptom:** Worker logs `whatsapp.dispatch_failed: HTTP 429 Too Many Requests`.
- **System Behavior:**
  - The outbox dispatcher detects 429 and applies exponential backoff with randomized jitter.
  - The outbound event remains in `flowdesk.outbox_events` with status `pending` and incremented `retry_count`.
  - Messages are NOT dead-lettered prematurely.
- **Operator Action:**
  1. Inspect `whatsapp_outbound_dispatch_total{result="failed"}`.
  2. Verify tier limit in Meta WhatsApp Business Manager (e.g. 1k -> 10k -> 100k daily messages limit).
  3. If tenant exceeded quota, reduce batch concurrency or pause bulk template campaigns.

### Scenario B: HTTP 500 / 503 (Meta Cloud API Outage)

- **Symptom:** Elevated error rates, `FlowDeskOutboxBacklogCritical` alert fires.
- **Safe Mode Transition:**
  1. Inbound messages continue to be accepted by ingress and safely stored in PostgreSQL.
  2. Outbox dispatch throttles poll interval from 500ms to 5,000ms to prevent connection thrashing.
  3. No messages are discarded; the outbox backlog will drain automatically upon Meta service restoration.
- **Recovery Verification:**
  - Watch `outbox_pending_events` drop to zero.
  - Verify idempotency keys prevent duplicate deliveries when retrying.

---

## 2. AI Provider (Gemini / LLM) Outage

### Scenario A: Gemini API 429 / 5xx / Timeout

- **Symptom:** `FlowDeskAiDraftFailureRateHigh` fires; `ai_draft_runs_total{status="failed"}` increases.
- **Safe Mode Behavior:**
  - The system fails closed for AUTO send: If an AI draft run fails or times out, AUTO cannot proceed.
  - Inbound messages are still routed to queues and agent teams with zero loss.
  - Conversations remain fully accessible for manual human agent responses in the web dashboard.
- **Operator Action:**
  1. If outage persists > 10 minutes, set tenant bot mode to `draft` or `off` to prevent unnecessary API call storms.
  2. Once Gemini status returns to green, re-enable `auto` mode.

---

## 3. Database Primary Failover / Saturation

### Scenario: DB Connection Saturation or Transient Failover

- **Symptom:** `DB Connection Pool Timeout` or `connection terminated unexpectedly`.
- **System Behavior:**
  - API and Worker pool automatically retries transient connection errors using exponential backoff.
  - Inbound webhook endpoint buffers requests if brief; if persistent, returns 503 so Meta retries the webhook.
  - No partial transactions are committed; RLS and tenant boundaries remain intact.
- **Recovery:**
  - Check AWS RDS / Aurora replica promotion.
  - Validate connection pool metrics (`pg_stat_activity`).

---

## 4. Redis Failures

Redis serves two independent roles in FlowDesk:

1. **Socket.IO pub/sub adapter** — multi-node realtime broadcast fan-out (`api` service).
2. **Query embedding cache** — optional tenant-scoped vector cache in the `worker` service.

Both roles are strictly ephemeral. All durable state lives in PostgreSQL.

### Scenario A: Socket.IO Redis Adapter Disconnects

- **Symptom:** `realtime.redis_adapter_failed` logged in the `api` service.
- **Safe Mode Behavior:**
  - Socket.IO server automatically falls back to single-node in-memory adapter (`redisRequired: false`).
  - Realtime room broadcasts continue locally on each API node.
  - Web UI clients reconnecting after a connection drop automatically trigger REST reconciliation to catch up on any missed timeline events.
- **Zero Data Loss Guarantee:**
  - All durable state (messages, events, drafts, routing logs) is persisted in PostgreSQL. Redis is strictly an ephemeral pub/sub layer.
- **Recovery:** Once Redis is healthy, restart API containers; the adapter reconnects automatically on next startup.

### Scenario B: Query Embedding Cache Degradation

- **Symptom:** `query_embedding_cache_total{outcome="error"}` counter rises; worker logs show `Embedding cache unavailable` or `Embedding cache deadline exceeded`.
- **Safe Mode Behavior:**
  - The embedding cache uses a **silent bypass** strategy: any Redis timeout or connection error causes the worker to call the AI embedding provider directly.
  - Bot draft generation continues without interruption. Latency may increase slightly as the provider is hit on every request.
  - A 5-second circuit-cooldown prevents connection storms after a Redis failure.
  - The admission-cap index (`fd:{env}:query-embedding:v1:entries`) is managed atomically; expired entries do not consume capacity.
- **Operator Action:**
  1. Check `query_embedding_cache_total{outcome="error"}` in Prometheus.
  2. Check `query_embedding_cache_total{outcome="bypass"}` — a sustained high bypass rate indicates cache is degraded.
  3. Confirm Redis connectivity: `docker compose exec redis redis-cli ping` (staging) or equivalent.
  4. No manual intervention is required for bot drafts; they degrade gracefully to direct provider calls.
- **Recovery:** Once Redis is healthy, the worker's next successful command resets the circuit cooldown (5 s) and cache hits resume automatically.
- **Disable the cache entirely:** set `QUERY_EMBEDDING_CACHE_ENABLED=false` in the worker environment and redeploy. The feature is opt-in and off by default.
- **Full runbook:** [docs/runbooks/query-embedding-cache.md](../runbooks/query-embedding-cache.md)
