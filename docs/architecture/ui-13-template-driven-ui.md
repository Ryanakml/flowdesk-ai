# UI-13 — Template-driven UI development

Tracking issue: #233

This branch is intentionally scaffolded before implementation so the remaining frontend migration can be developed in one clean workstream.

Donor UI source: `satnaing/shadcn-admin`.

## Guardrails

- FlowDesk remains the authoritative application.
- Donor code is used for presentation/layout acceleration only.
- Existing FlowDesk API contracts, RBAC, routing, realtime behavior, tenant boundaries, and business logic remain authoritative.
- Donor-only mock features are removed rather than carried into production.
- Substantial copied MIT-licensed portions retain required copyright/license notices.

Implementation details and donor-to-FlowDesk mapping will be added in subsequent commits.
