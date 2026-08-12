# AI operations governance

## Enforced in this repository

- Every authenticated research request carries a unique `X-Request-ID`.
- General Evidence Assist calls have a 30-second client deadline; report-agent
  workflows explicitly opt into a bounded three-minute deadline.
- Caller abort signals are forwarded, and timed-out requests fail with a clear
  error instead of remaining pending indefinitely.
- Report-agent responses are rejected when their identity envelope or token
  usage is malformed, negative, or internally impossible.
- The Supabase report-agent function rejects oversized requests, disables HTTP
  caching, and aborts its upstream model call after a bounded configurable
  deadline (`OPENAI_REPORT_AGENT_TIMEOUT_MS`, 10-180 seconds). Its completion
  allowance can also be lowered server-side with
  `OPENAI_REPORT_AGENT_MAX_COMPLETION_TOKENS` (1,000-8,000 tokens).
- Concept-image generation retains its existing server-enforced tenant budget.
- Per-report model usage and estimated cost remain stored in the immutable
  commercialization-report snapshot.

## Deliberately not claimed yet

The dashboard calls `/api/report-agent` on the separate Vercel research service.
That service repository is not part of this workspace, and the configured
Supabase project is currently unavailable. Therefore this change does **not**
claim durable report-job deduplication, organization-wide report budgets, or
cross-request rate limiting.

Those guarantees require one coordinated release after the live-schema
checkpoint is restored:

1. Add an organization-scoped AI job/usage ledger through a forward migration.
2. Regenerate `database.types.ts` from the restored live schema.
3. Make the research service claim jobs atomically by stable task identity.
4. Enforce organization budget and concurrency before contacting a model.
5. Persist terminal success/failure, actual usage, cost basis, retry count, and
   model identity.
6. Expose aggregate report usage beside concept-image spend in Operations.
7. Test duplicate delivery, timeout recovery, concurrent claims, tenant
   isolation, and exhausted-budget behavior against disposable Supabase.

Until that release, the UI explicitly describes report usage as recorded rather
than capped.
