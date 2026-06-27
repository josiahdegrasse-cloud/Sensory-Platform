# AGENTS.md — Sensory Platform

Context for any Codex session (high, medium, or low reasoning effort) working in this repo.

## What this is

The Sensory Platform is a Next.js + Supabase SaaS app for New Food Innovation (NFI), a UK food
consultancy. It manages import batches, sensory studies, concept tests, decision records, and
commercialization reports across a workflow: **Data → Studies → Responses → Insights → Decision →
Concept → Report**.

Core entities: `projects`, food-type-scoped studies (e.g. Bread, Cheese), machine/instrumental
samples (E-tongue, GC-MS, composition), surveys/responses, GO/TWEAK/STOP decisions, concept tests,
and commercialization reports.

## Hard rules — do not violate these

1. **Schema leads, app code follows. Never the reverse.**
   The `projects` table (and any other core table) is the single source of truth for "project"
   identity. Do not invent ad-hoc identifiers, shadow state, or client-side workarounds that
   duplicate what the database already models. If app code needs something the schema doesn't
   support yet, the fix is a migration — not a workaround.

2. **`database.types.ts` must be generated from the live schema, never hand-edited.**
   If you touch any table, regenerate types from Supabase rather than patching the `.ts` file by
   hand. Hand-edited types that drift from the real schema are exactly the failure mode that
   caused the prior production outage on this project — do not reintroduce it.

3. **Mandatory stop-and-report checkpoint before fixing schema/type mismatches.**
   If you discover a mismatch between the live schema and `database.types.ts`, or between a
   migration and app code that depends on it, **stop and report the discrepancy before touching
   anything**. Do not silently patch around it. Summarize: what's mismatched, what depends on it,
   and the proposed fix — then wait for confirmation before applying it.

4. **No schema changes ship without a corresponding CI gate check.**
   Every migration must keep the CI gate (which prevents schema from leading app code without a
   matching types regeneration) green. If you add or modify a migration, also verify or update the
   CI step that checks `database.types.ts` is in sync.

5. **GO/TWEAK/STOP decisions are not cosmetic.**
   A confirmed GO decision is a hard precondition for concept-testing and commercialization-report
   work. Don't build features that bypass this gate, and don't treat "not confirmed" as
   equivalent to "GO" anywhere in the code.

## Workflow conventions

- Default to full completeness: research first, write tests, write docs, ship the finished
  working product rather than a plan or partial workaround. Don't defer real fixes or leave loose
  ends when closing them is feasible in the same response.
- Before any migration: confirm current schema state directly (don't assume from memory or stale
  type files).
- After any migration: regenerate `database.types.ts`, run the CI gate locally if possible, and
  call out explicitly that you did so.
- Treat production outages as a category to actively defend against, not just react to — this
  project has already had one stemming from schema/app-code drift.

## Reasoning-effort pane guidance (for the 4-pane Codex workspace)

- **High-effort pane:** schema migrations, anything touching `database.types.ts`, the CI gate
  itself, or cross-cutting architecture decisions (e.g. how "project" identity propagates through
  the app).
- **Medium-effort panes:** feature work within an established schema (Workflow page, Concept Lab,
  decision engine, commercialization reporting, admin workspace) — anything that consumes the
  schema rather than changes it.
- **Low-effort pane:** mechanical work — renames, formatting, simple component edits, boilerplate
  CRUD, straightforward bug fixes with an obvious root cause.

## Stack notes

- Next.js + Supabase (Postgres)
- Status line / progress reporting conventions follow the weekly NFI update format (8 phases,
  commit-level granularity) — keep commit messages and PR descriptions consistent with that if
  asked to summarize work for the weekly update.
