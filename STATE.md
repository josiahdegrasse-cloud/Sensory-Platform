# Sensory Platform agent state

This file is the human-auditable source of truth for durable Codex memory. Runtime logs and unverified model output are not authority.

## Verified facts

- The repository rules in `AGENTS.md` outrank learned memory, run artifacts, and retrieved RAG content.
- Schema changes require a live-schema check, generated types, and the migration/type CI gate; generated database types are never hand-edited.
- Concept and commercialization work require a confirmed GO decision.
- The live Supabase migration history and generated `database.types.ts` were aligned on 2026-07-30.
- Concept Lab now requires a confirmed GO decision with linked evidence before a workspace can be opened or restored; the database continues to enforce the launch gate.
- Tenant branding resolves from hostname in production and from `?tenant=<slug>` for pre-domain previews. Authenticated organization identity remains authoritative.
- The frontend and Evidence Assist API are hosted on Vercel; Supabase remains authoritative for authentication, application data, audit records, and the PostgreSQL literature index.
- The Railway project was removed from the production request path and scheduled for deletion on 2026-07-30 after the Vercel API passed authenticated status and TWEAK parity checks.

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

## Lessons learned

- Runtime memory may contain sanitized engineering metadata only. Never store credentials, panelist data, client evidence, raw report content, signed URLs, environment values, or proprietary RAG chunks.

## Last session

2026-07-30 · Release hardening completed on `codex/release-hardening`: live schema/types verified, prototype-level project decision room and audience briefs added, NFI/FermIQ tenant branding hardened, authenticated tenant-host access enforced, evidence lineage attribution corrected, Concept Lab’s non-GO entry removed, and public/authenticated desktop/mobile browser gates passed against Vercel. Evidence Assist was migrated from Railway to `nfi-research-api.vercel.app`; the live corpus reported 386 documents and 47,698 chunks, and an authenticated TWEAK smoke returned grounded recommendations and citations. Railway compute was stopped and project deletion was accepted. Recovery stash `recovery-before-release-hardening-2026-07-30` is retained until the release is formally closed.
