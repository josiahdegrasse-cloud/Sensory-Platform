# AI Report Workflow Plan

## Current Architecture

- Commercialization reports are stored in `public.commercialization_reports` and created through `create_commercialization_report(...)`.
- The current report path is UI-driven:
  - `CommercializationReportBuilder` selects a confirmed GO decision, concept test, and packaging image.
  - `buildCommercializationSnapshot` creates a deterministic JSON snapshot.
  - `downloadCommercializationReportPdf` renders the saved snapshot to PDF.
  - `evaluateCommercializationReport` checks generated PDF structure and copy quality.
- GO / TWEAK / STOP logic lives in `src/app/utils/go-stop-tweak-engine.ts`.
- Current project state is assembled from products, responses, import batches, instrumental samples, decision records, concept tests, and report rows. There is no first-class `projects` table yet, so the first Evidence Bundle implementation uses the current sample/project key as `projectId`.
- AI model calls currently exist for concept image generation, not for report writing. Commercialization narrative is deterministic string assembly.

## Proposed Architecture

- Add immutable Evidence Bundles as the report workflow source of truth.
- Keep deterministic calculations in TypeScript services:
  - input validation
  - GO / TWEAK / STOP candidate decision
  - critical gate extraction
  - screening alignment summaries
  - missing-data and quality-warning records
  - source-data fingerprinting
- Save Evidence Bundles before report generation and reference them from new workflow runs.
- Later milestones should layer on:
  - structured decision interpretation with evidence-ID validation
  - report plan generation
  - section-level generation
  - evaluator fan-out
  - targeted revisions
  - human approval and publishing states

## Files To Modify

- `src/app/lib/database.ts`
- `src/app/lib/hooks.ts`
- `src/app/lib/db/concepts.ts`
- `src/app/lib/report-evidence.ts`
- `supabase/migrations/*_evidence_bundles.sql`
- `src/app/lib/report-evidence.test.ts`

## New Files To Create

- `docs/ai-report-workflow-plan.md`
- `src/app/lib/report-evidence.ts`
- `src/app/lib/report-evidence.test.ts`
- `supabase/migrations/20260616000000_evidence_bundles.sql`

## Database Changes

- Add `public.evidence_bundles`:
  - immutable payload JSON
  - project/sample key
  - version
  - schema version
  - source-data version
  - creator and timestamp
  - tenant isolation through existing `org_id` pattern when available
- Add `commercialization_reports.evidence_bundle_id` as nullable for backward compatibility.
- Preserve existing report rows. Rows without an evidence bundle are legacy reports.

## Migration Strategy

- Additive migration only.
- Do not rewrite existing report snapshots.
- New reports can reference an Evidence Bundle; old reports continue loading from `report_snapshot`.
- Use unique `(project_id, version)` and `(project_id, source_data_version)` constraints to avoid duplicate immutable bundles for unchanged data.
- RLS mirrors admin-only report internals so panelists cannot read bundle payloads.

## Risks

- Current `projectId` is a sample/project key rather than a normalized project foreign key.
- Imported samples only produce full deterministic report evidence after enough panel responses exist.
- Existing threshold defaults differ slightly between code comments and workspace defaults; the bundle records the thresholds it used.
- Report quality evaluation is currently PDF-level and not yet claim-level.
- Supabase generated types are not checked in for this repo; database type regeneration should be run after applying migrations in linked environments.

## Rollout Order

1. Ship Evidence Bundle types, deterministic builder, source fingerprinting, storage, migration, and tests.
2. Add Decision Interpreter schemas and post-validation.
3. Add report plan and section-level generation.
4. Add evaluator fan-out, aggregate scoring, and targeted revision loop.
5. Add UI progress, quality panel, staleness indicators, human approval, and publishing.
6. Add regression fixtures, observability, legacy migration labeling, and controlled-learning trace capture.
