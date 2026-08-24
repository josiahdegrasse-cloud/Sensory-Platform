# AI operations governance

## Current controls

- Authenticated research requests carry a unique request ID and a 30-second
  client deadline.
- Caller cancellation is forwarded, and timeouts fail with a clear error.
- Commercialization-report prose is written in the administrator's browser with
  a WebGPU-backed Llama model; it is not sent to OpenAI.
- A verified writer packet limits the local model to approved facts, claims,
  decisions, limitations, and actions.
- Deterministic quality checks validate the report and can request up to two
  focused local correction passes.
- Saved reports record model identity, token counts, correction count, execution
  location, and external model cost.
- Concept-image generation is authenticated and subject to tenant controls,
  budgets, audit records, and server-side enforcement.

## Boundaries

The Vercel research service supports Evidence Assist, literature management, and
diagnostics. It is separate from local report writing.

Local report generation requires WebGPU, sufficient storage, and compatible
graphics memory. If the model cannot run or return a complete structured result,
the report is not saved.

Hosted AI usage is recorded, but organization-wide budget and concurrency
guarantees are not claimed for every hosted feature. Any future expansion of
those controls requires a schema migration, regenerated database types,
tenant-isolation tests, and server-side enforcement before contacting a model.
