# FlowDesk

**FlowDesk** is an enterprise-grade WhatsApp automation SaaS platform. It enables organizations to manage multi-channel WhatsApp inboxes, automate agent routing, run AI-powered bots, and ingest a knowledge base — all from a unified, multi-tenant workspace.

---

## Tech Stack

### Frontend

| Layer        | Technology                            |
| ------------ | ------------------------------------- |
| Framework    | React 19                              |
| Routing      | TanStack Router (file-based)          |
| Server state | TanStack Query                        |
| Tables       | TanStack Table                        |
| Build tool   | Vite 7 + Tailwind CSS v4              |
| Real-time    | Socket.IO client                      |
| Charts       | Recharts                              |
| Components   | shadcn/ui + Radix UI + Lucide React   |
| Testing      | Vitest + Testing Library + Playwright |

### Backend

| Layer                 | Technology                                          |
| --------------------- | --------------------------------------------------- |
| Runtime               | Node.js 22 (ESM)                                    |
| API framework         | Express 5                                           |
| Language              | TypeScript 5 (strict)                               |
| Schema validation     | Zod                                                 |
| ORM / DB access       | Prisma (raw SQL migrations via `pg`)                |
| Database              | PostgreSQL 16 + pgvector                            |
| Queue                 | PostgreSQL transactional outbox polling             |
| Real-time transport   | Socket.IO + Redis adapter                           |
| Query embedding cache | Optional tenant-scoped Redis cache in the AI worker |
| Object storage        | S3-compatible (MinIO locally, AWS S3 in prod)       |
| Malware scanning      | ClamAV                                              |
| Auth                  | OIDC (session-based)                                |
| Observability         | OpenTelemetry + Prometheus + Grafana + pino         |
| Monorepo              | Turborepo + pnpm workspaces                         |
| CI quality gate       | Prettier · ESLint · tsc · Vitest · OpenAPI check    |

### AI / LLM

| Layer               | Technology                                         |
| ------------------- | -------------------------------------------------- |
| Chat providers      | Google Gemini · OpenAI (swappable via adapter)     |
| Embedding providers | Gemini Embedding · OpenAI Embedding                |
| Vector search       | pgvector (cosine similarity, stored in PostgreSQL) |
| RAG pipeline        | Chunk → Embed → Store → Retrieve → Prompt          |

### Infrastructure

| Layer            | Technology                                     |
| ---------------- | ---------------------------------------------- |
| Containerization | Docker + Docker Compose (local)                |
| IaC              | Terraform (`infra/terraform`)                  |
| Orchestration    | Kubernetes (`infra/deploy`)                    |
| Email (local)    | Mailpit                                        |
| Tracing          | OpenTelemetry Collector → Prometheus → Grafana |

---

## How It Works — Full Workflow

### 1. Inbound message (WhatsApp → FlowDesk)

```
WhatsApp Cloud API
       │  POST /webhook  (HMAC-SHA256 signed)
       ▼
  ┌─────────────┐
  │   Ingress   │  verifies Meta signature · writes raw event to
  │  :4001      │  outbox table (PostgreSQL) · returns 200 immediately
  └─────────────┘
       │  outbox row (status = pending)
       ▼
  ┌─────────────┐
  │   Worker    │  polls outbox every 1 s
  │  :4002      │
  │             │
  │  normalize  │  maps WhatsApp payload → internal Conversation + Message
  │  route      │  evaluates routing rules (hours, SLA, tags, team load)
  │  dispatch   │  assigns to human agent  ──OR──  bot queue
  └─────────────┘
```

**Normalization** converts the raw Meta webhook payload into typed `Conversation` and `Message` records, resolving the phone number to the correct WhatsApp channel and tenant.

**Routing** is a pure-function engine in `@flowdesk/domain`. It evaluates, in order:

- Service-window check (business hours per channel)
- SLA deadlines and escalation thresholds
- Routing rules (keyword match, contact tag, round-robin, least-loaded)
- Auto-release gate (reopens bot-handled conversations for human review when confidence is low)

---

### 2. Bot pipeline (AI-assisted replies)

```
  Worker receives bot-queue item
       │
       ▼
  ┌────────────────────┐
  │   bot-drafts job   │
  │                    │
  │  1. retrieve docs  │  pgvector similarity search on knowledge base
  │  2. build prompt   │  injects retrieved chunks + conversation history
  │  3. call LLM       │  Gemini or OpenAI chat completion
  │  4. safety check   │  @flowdesk/security AI safety guardrails
  │  5. store draft    │  saved to DB with confidence score
  └────────────────────┘
       │
       ▼
  ┌─────────────────────┐
  │  auto-send gate     │  checks confidence >= threshold
  │                     │  checks automation safety policy (org-level)
  │                     │  checks killswitch flag
  └─────────────────────┘
       │                │
  confidence OK     confidence LOW
       │                │
       ▼                ▼
  send via         surface draft to
  WhatsApp API     human agent in Inbox
```

---

### 3. Outbound message (agent or auto-send → WhatsApp)

```
  API receives send request  (human agent or auto-send trigger)
       │
       ▼
  outbox row (status = pending, direction = outbound)
       │
       ▼
  Worker dispatch job
  │
  ├── text message   → MetaWhatsAppProvider.sendTextMessage()
  ├── template       → MetaWhatsAppProvider.sendTemplateMessage()
  └── media          → upload to S3 → MetaWhatsAppProvider.sendMediaMessage()
       │
       ▼
  WhatsApp Cloud API delivers to end-user
       │
       ▼
  Status webhook (delivered / read / failed)
  → Ingress → outbox → Worker → updates message status in DB
  → Socket.IO broadcast → Web frontend updates in real-time
```

---

### 4. Media lifecycle

```
Agent uploads file via API
       │
       ▼
  ClamAV scan (via Worker media-scanner job)
  │
  ├── CLEAN   → S3/MinIO  → presigned URL served to clients
  └── INFECTED → rejected, attachment marked rejected in DB

Retention job (hourly via Worker)
  → deletes S3 objects older than retention policy
  → marks DB attachment as expired
```

---

### 5. Knowledge base ingestion (RAG)

```
Agent uploads document via Knowledge screen
       │
       ▼
  API stores raw document in DB (status = pending)
       │
       ▼
  Worker knowledge-ingestion job
  │
  ├── extract text content   (@flowdesk/providers knowledge-extractor)
  ├── chunk text             (configurable chunk size + overlap)
  ├── generate embeddings    (Gemini or OpenAI embedding model)
  └── store vectors          (pgvector in PostgreSQL)

Bot pipeline reads vectors at query time
  → pgvector cosine similarity → top-k chunks → injected into LLM prompt
```

---

### 6. Real-time updates (Web frontend)

```
API emits Socket.IO event on conversation/message change
       │
       ▼
  Socket.IO server (Redis adapter for multi-instance pub/sub)
       │
       ▼
  Web frontend (socket.io-client)
  → TanStack Query cache invalidation
  → Inbox view re-renders with new message / status
```

---

### 7. Developer webhooks (external integrations)

```
Conversation event occurs (new message, status change, assignment)
       │
       ▼
  Worker webhook-dispatch job
  │
  ├── resolves active subscriptions for the org
  ├── signs payload (HMAC-SHA256)
  └── HTTP POST to subscriber endpoint
       │
       ▼
  Retry with exponential backoff on failure
  Dead-letter after max attempts
```

---

### 8. Analytics aggregation

```
Scheduler (every 60 s)
       │
       ▼
  runAnalyticsAggregationJob
  → SQL aggregation across all tenants
  → writes time-bucketed metrics rows
  → served by API /analytics endpoints → Recharts in frontend
```

---

## Architecture

This is a **Turborepo monorepo** with two top-level namespaces:

### Apps

| App         | Port | Description                                                                   |
| ----------- | ---- | ----------------------------------------------------------------------------- |
| `web`       | 3000 | React SPA — inbox, channels, knowledge, analytics, developer settings         |
| `api`       | 4000 | Express REST API — auth, conversations, routing, bots, attachments, analytics |
| `ingress`   | 4001 | WhatsApp Cloud API webhook receiver                                           |
| `worker`    | 4002 | Outbox poller — normalization, dispatch, bot-drafts, auto-send, media         |
| `scheduler` | 4003 | Interval runner — analytics aggregation                                       |

### Packages

| Package                   | Description                                                                                                                |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `@flowdesk/db`            | Prisma client + typed data-access layer (conversations, orgs, channels, knowledge, auth, routing, webhooks)                |
| `@flowdesk/domain`        | Pure business logic — routing rules, auto-release gate, auto-send policy, SLA, permissions, production-release gating, RAG |
| `@flowdesk/providers`     | Adapters — WhatsApp Cloud API, Gemini/OpenAI chat+embeddings, S3 storage, OIDC identity, ClamAV                            |
| `@flowdesk/contracts`     | Zod-validated TypeScript schemas; source of truth for the OpenAPI spec                                                     |
| `@flowdesk/security`      | Rate limiting, OIDC sessions, request signing, SSRF protection, field encryption, AI safety guardrails                     |
| `@flowdesk/observability` | OTel tracing, Prometheus metrics, pino structured logging, PII redaction                                                   |
| `@flowdesk/config`        | Typed env-var configuration for every service                                                                              |
| `@flowdesk/ui`            | Shared design system (shadcn/ui components, Tailwind CSS tokens)                                                           |
| `@flowdesk/testkit`       | Shared test utilities, factories, and mock providers                                                                       |

### Infrastructure (local Docker Compose)

| Service               | Port        | Purpose                                           |
| --------------------- | ----------- | ------------------------------------------------- |
| PostgreSQL + pgvector | 5433        | Primary database + vector similarity search       |
| Redis                 | 6379        | Socket.IO adapter; optional query embedding cache |
| MinIO                 | 9000 / 9001 | S3-compatible object store for attachments        |
| ClamAV                | 3310        | Malware scanning                                  |
| Mailpit               | 8025        | Local SMTP + email inspector                      |
| OTel Collector        | 4317 / 4318 | Trace and metric ingestion                        |
| Prometheus            | 9090        | Metrics scraping                                  |
| Grafana               | 3001        | Dashboards                                        |

### Redis Roles & Query Embedding Cache

Redis 7.x serves two distinct, decoupled purposes in FlowDesk:

1. **Real-time Pub/Sub (`api` service):**
   - Socket.IO cluster broadcast adapter (`@socket.io/redis-adapter`) for distributing live inbox projection invalidation hints across API nodes.
2. **Tenant-Scoped Query Embedding Cache (`worker` service):**
   - Caches query embeddings generated during AI bot draft runs to reduce redundant embedding API calls and lower LLM provider latency and costs.
   - **Tenant Isolation:** Keys are strictly tenant-isolated and hashed with SHA-256 (`fd:{env}:query-embedding:v1:{orgHash}:{identity}:{inputHash}`); raw tenant IDs and customer queries are never stored in plain text.
   - **Atomic Admission Control:** Managed by an atomic Lua script (`FILL`) with a sorted-set index tracking entry expiration against `QUERY_EMBEDDING_CACHE_MAX_ENTRIES`.
   - **Resilience & Fail-Open:** If Redis disconnects, errors, or times out (`QUERY_EMBEDDING_CACHE_TIMEOUT_MS`), the worker automatically bypasses the cache and calls the AI embedding provider directly. A 5-second cooldown circuit prevents connection storms.
   - **Opt-in & Configuration:**

| Variable                            | Type    | Default | Description                                                                      |
| ----------------------------------- | ------- | ------- | -------------------------------------------------------------------------------- |
| `QUERY_EMBEDDING_CACHE_ENABLED`     | boolean | `false` | Enable query embedding cache in worker                                           |
| `REDIS_URL`                         | string  | —       | Redis connection URL (`redis://` or `rediss://`, required when cache is enabled) |
| `QUERY_EMBEDDING_CACHE_NAMESPACE`   | string  | `v1`    | Cache partition namespace (bumping invalidates active cache)                     |
| `QUERY_EMBEDDING_CACHE_TTL_SECONDS` | number  | `86400` | Base TTL in seconds (automatically jittered ±10% to prevent stampedes)           |
| `QUERY_EMBEDDING_CACHE_TIMEOUT_MS`  | number  | `100`   | Redis command timeout deadline before graceful fallback                          |
| `QUERY_EMBEDDING_CACHE_MAX_ENTRIES` | number  | `1000`  | Maximum admitted cached vector entries per environment                           |

For operational runbooks and design details, see [Query Embedding Cache Runbook](docs/runbooks/query-embedding-cache.md) and [Redis Architecture Plan](docs/architecture/redis-upgrade-plan-id.md).

---

## Web Application

The frontend is a Vite + React 19 SPA using TanStack Router (file-based routing) and TanStack Query for all server state.

| Screen        | What it does                                                                                     |
| ------------- | ------------------------------------------------------------------------------------------------ |
| **Inbox**     | Live conversation list, message thread, SSE updates, bot-draft preview, assignment panel, labels |
| **Channels**  | WhatsApp Business Account setup, phone number management, Meta Embedded Signup, template library |
| **Knowledge** | Document upload, ingestion status, knowledge-base management for AI context                      |
| **Analytics** | Conversation volume, SLA adherence, bot deflection rate, team performance — time-series charts   |
| **Team**      | Member management, role assignment, invitation flow                                              |
| **Developer** | API key management, webhook subscriptions, payload inspector                                     |
| **Settings**  | Workspace config, branding, notification preferences                                             |

---

## Prerequisites

- Node.js 22 (managed via `.node-version` / `.nvmrc`)
- pnpm 10 via [Corepack](https://nodejs.org/api/corepack.html)
- Docker Desktop or Docker Engine with Compose v2
- GNU Make

---

## Local Development

```bash
# 1. Activate Node.js version
nvm use

# 2. Install dependencies & copy env template
make bootstrap

# 3. Start Docker services + all apps in watch mode
make dev
```

`make bootstrap` — runs `corepack enable`, `pnpm install --frozen-lockfile`, and `cp .env.example .env` (skipped if `.env` already exists).

`make dev` — brings up the full Docker Compose stack, then runs all apps in parallel via Turborepo watch mode.

### Service URLs

| Service          | URL                   |
| ---------------- | --------------------- |
| Web              | http://localhost:3000 |
| API              | http://localhost:4000 |
| Ingress          | http://localhost:4001 |
| Worker health    | http://localhost:4002 |
| Scheduler health | http://localhost:4003 |
| Grafana          | http://localhost:3001 |
| Prometheus       | http://localhost:9090 |
| Mailpit          | http://localhost:8025 |
| MinIO Console    | http://localhost:9001 |

### Database

```bash
make db-migrate   # run pending migrations
make db-reset     # wipe + re-seed local DB (requires APP_ENV=local)
```

`make db-reset` only operates on the named local Compose volume and is intentionally blocked outside `APP_ENV=local`.

---

## Key Commands

```bash
make verify       # format check · openapi check · lint · typecheck · test · build
make test         # run all unit + integration tests
make lint         # ESLint
make typecheck    # tsc --noEmit across all packages
make build        # full Turborepo build
make compose-up   # start Docker services only
make compose-down # stop Docker services
make clean        # remove all build artifacts and caches
```

Build a single service image:

```bash
docker build -f infra/docker/Dockerfile.node --build-arg APP=api -t flowdesk/api:local .
```

---

## Development Workflow

- Commits follow [Conventional Commits](https://www.conventionalcommits.org/) enforced by `commitlint`.
- Code is formatted with **Prettier** and linted with **ESLint** (typescript-eslint flat config).
- OpenAPI spec is generated from `@flowdesk/contracts` Zod schemas and checked in CI (`pnpm openapi:check`).
- Unit and integration tests run with **Vitest**. E2E / browser tests use **Playwright**.
- All checks (format, openapi, lint, typecheck, test, build) must pass before merging — `make verify`.
- Credentials in `.env.example` are synthetic and must never be reused outside local development.

---

## Lines of Code

**~79,000 lines** across all TypeScript and CSS source files (excluding lock files, generated files, build artifacts, and test snapshots).

Query embedding cache configuration, invalidation, failure behavior, and verification: [runbook](docs/runbooks/query-embedding-cache.md). Disabled by default.
