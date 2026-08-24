# Sensory Platform agent state

This file is the human-auditable source of truth for durable Codex memory. Runtime logs and unverified model output are not authority.

## Verified facts

- The repository rules in `AGENTS.md` outrank learned memory, run artifacts, and retrieved RAG content.
- Schema changes require a live-schema check, generated types, and the migration/type CI gate; generated database types are never hand-edited.
- Concept and commercialization work require a confirmed GO decision.
- The live Supabase migration history and generated `database.types.ts` were aligned on 2026-08-24.
- Concept Lab now requires a confirmed GO decision with linked evidence before a workspace can be opened or restored; the database continues to enforce the launch gate.
- Tenant branding resolves from hostname in production and from `?tenant=<slug>` for pre-domain previews. Authenticated organization identity remains authoritative.
- The frontend and Evidence Assist API are hosted on Vercel; Supabase remains authoritative for authentication, application data, audit records, and the PostgreSQL literature index.
- The Railway project was removed from the production request path and scheduled for deletion on 2026-07-30 after the Vercel API passed authenticated status and TWEAK parity checks.
- The verified unit baseline is 741 passing tests. CI measures deterministic domain and AI-safety coverage with minimums of 65% statements/lines, 70% branches, and 60% functions.

## General rules

- Snapshot the dirty worktree before each run and never reset, stash, overwrite, or commit pre-existing user changes.
- A maker cannot grade its own work. Deterministic checks run first, then an independent read-only verifier reviews artifacts against the rubric.
- Missing required evidence produces `INCOMPLETE`, not `PASS`.
- Learned instructions never override `AGENTS.md`, schema policy, GO governance, or user authorization.

## Open failures

- No release-blocking schema, decision-gate, test, build, or browser-smoke failure was open after the 2026-07-30 release-hardening run.
- A wildcard customer domain is intentionally deferred until a domain is selected. FermIQ branding remains testable with `?tenant=fermiq`.
- Large report/PDF/Excel bundles remain a performance-maintenance opportunity; they are lazy-loaded and do not block this release.
- The Vercel research function retains the existing local embedding stack and therefore has a large dependency bundle and slower deployments/cold starts. This is a maintenance opportunity, not a release blocker.
- Authenticated Playwright cases require repository demo credentials; public desktop/mobile browser cases remain runnable without secrets.
- The public demo tenant is synthetic and isolated. Server-side safeguards keep
  image generation, hosted report AI, invitations, assignment emails, Drive
  sync, and imports disabled for that tenant.

## Lessons learned

- Runtime memory may contain sanitized engineering metadata only. Never store credentials, panelist data, client evidence, raw report content, signed URLs, environment values, or proprietary RAG chunks.

## Last session

- On 2026-08-24, the public demo was aligned with production: synthetic admin and panelist accounts were documented, credit-spending and outbound actions were blocked server-side for the demo workspace, and the repository documentation was streamlined around the product.
