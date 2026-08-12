# Release evidence

Copy this template into the release ticket. Do not record secret values.

## Identity

- Release date/time:
- Operator:
- Commit SHA:
- Frontend deployment ID / rollback target:
- Research API deployment ID / rollback target:
- Database migration head:

## Automated gates

- Runtime baseline:
- Typecheck and lint:
- Unit tests:
- Browser smoke tests:
- Disposable tenant-isolation tests:
- Live schema/type drift check:
- Live migration drift check:
- Production dependency audit:
- Production build and bundle budget:

## Operational checks

- Supabase connectivity:
- Evidence Assist readiness and index counts:
- Failed imports reviewed:
- Prototype-lineage exceptions reviewed:
- Concept-image spend/cap reviewed:
- Sentry release and source maps verified:
- Apex and wildcard tenant TLS verified:

## Promotion decision

- Decision: promote / hold / rollback
- Known limitations:
- Approver:
- Evidence links:
