# AI operations governance

## Enforced in this repository

- Every authenticated research request carries a unique `X-Request-ID`.
- General Evidence Assist calls have a 30-second client deadline.
- Caller abort signals are forwarded, and timed-out requests fail with a clear
  error instead of remaining pending indefinitely.
- Commercialization-report prose is written in the administrator's browser by
  a WebGPU-backed Llama model. The report builder does not call OpenAI or the
  remote report-agent endpoint.
- A verified writer packet limits Local Llama to approved facts, claims,
  decisions, limitations, and actions. Deterministic QC checks the resulting
  prose and can request up to two focused local correction passes.
- Model weights are cached by the browser after the first download. Saved
  reports record the exact local model, correction count, and £0 external model
  cost.
- Concept-image generation retains its existing server-enforced tenant budget.
- Per-report model usage and estimated cost remain stored in the immutable
  commercialization-report snapshot.

## Deliberately not claimed yet

The separate Vercel research service remains available for Evidence Assist,
literature-library, and diagnostic features. It is not required for Local Llama
report writing. The application does **not** claim that every device can run the
local model: WebGPU, sufficient browser storage, and compatible graphics memory
are required.

Organization-wide usage guarantees for other hosted AI features still require
one coordinated release after the live-schema checkpoint is restored:

1. Add an organization-scoped AI job/usage ledger through a forward migration.
2. Regenerate `database.types.ts` from the restored live schema.
3. Make the research service claim jobs atomically by stable task identity.
4. Enforce organization budget and concurrency before contacting a model.
5. Persist terminal success/failure, actual usage, cost basis, retry count, and
   model identity.
6. Expose aggregate report usage beside concept-image spend in Operations.
7. Test duplicate delivery, timeout recovery, concurrent claims, tenant
   isolation, and exhausted-budget behavior against disposable Supabase.

Until that release, hosted AI usage is described as recorded rather than
organization-capped. Local Llama report writing remains free of external model
charges.
