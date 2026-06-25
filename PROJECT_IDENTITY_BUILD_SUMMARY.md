# Project Identity — Build Summary

Promotes "project" from a computed UI label to a real `projects` entity that can
span multiple `import_batches` over time. Built in three parts per the Phase 2
spec. **Status: COMPLETE — code built + verified, and the migration is APPLIED to
the linked production DB (`golkgpeqenyqrcyawjdt`), recorded as `20260625000000`
on both local and remote.** Post-apply verification counts are confirmed below.

> One fix was needed during apply: `CREATE OR REPLACE FUNCTION` cannot rename an
> existing function's parameter (`target_project_id` → `target_sample_id`,
> SQLSTATE 42P13). The migration now `DROP FUNCTION`s `create_evidence_bundle`
> before recreating it. The first push attempt failed on this and rolled back
> fully (transactional — verified: no partial state); the patched migration
> applied cleanly. **App code must be deployed alongside this migration** — the
> running app reads the renamed columns.

---

## Pre-flight verification (live DB, read-only)

Confirmed the discovery snapshot still matches before building:

- Latest migration is `20260620000000_drive_sync.sql` → new file named `20260625000000_projects.sql`.
- 15 import_batches; exactly **2 active**, IDs unchanged:
  - Cheese June `0fdbce34-7dd9-409d-a0af-2e6269719ee6` (food_type `b7c7b742-…`)
  - Bread `99fc5e55-29d2-48f9-b4ca-83aa08b4c54e` (food_type `72f767ae-…`)
- Counts match discovery: 126 instrumental_samples, 15 decision_records,
  25 commercialization_reports, 81 products, 4 concept_tests, 2 evidence_bundles.

No discrepancies — proceeded.

---

## Part 1 — Migration `supabase/migrations/20260625000000_projects.sql`

- **`projects` table** — id, name, food_type_id (FK → food_types, RESTRICT),
  status (CHECK active/archived/deleted), started_at, created_by, created_at,
  updated_at, org_id. Indexes on food_type_id, org_id, status.
- **RLS** — the documented two-layer pattern: permissive `projects_select_authenticated`
  (`status <> 'deleted' OR is_admin()`) + `projects_admin_all`, plus the
  `AS RESTRICTIVE org_isolation` policy and a `BEFORE INSERT` `set_org_id()` trigger.
- **`project_id` FK** (nullable, `ON DELETE SET NULL`) + index added to:
  import_batches, instrumental_samples, decision_records,
  commercialization_reports, products, concept_tests.
- **Column renames** (the colliding "project" names):
  - `evidence_bundles.project_id → sample_id` (it held a sample id, e.g. S4/S12).
    Both UNIQUE constraints renamed (`…_project_id_version_key → …_sample_id_version_key`,
    `…_project_id_source_data_version_key → …_sample_id_source_data_version_key`);
    indexes `idx_evidence_bundles_project → idx_evidence_bundles_sample` and
    `…_source_data → …_sample_source_data`. The `create_evidence_bundle()` RPC was
    recreated (CREATE OR REPLACE, same 4-arg signature) with the body/param renamed
    to `target_sample_id` so callers (positional/named) keep working.
  - `concept_tests.project_name → concept_folder_name` and
    `concept_image_generations.project_name → concept_folder_name`; indexes
    `idx_concept_tests_project → idx_concept_tests_concept_folder`,
    `idx_concept_image_generations_project → idx_concept_image_generations_concept_folder`.
- **Backfill** (active batches only): create 2 projects named
  `"{FoodType} — {Month YYYY}"` from each active batch's `imported_at`
  (e.g. `"Cheese — June 2026"`, `"Bread — June 2026"`), then cascade `project_id`
  down: batches → instrumental_samples → decision_records (text sample_id match,
  best-effort) → commercialization_reports (via decision FK) → products (via
  source_import_batch_id). `concept_tests` intentionally **not** backfilled (no
  batch FK exists). The 13 dead batches stay `project_id NULL`.
- **Verification block** — a `DO $$ … RAISE NOTICE` at the end prints the project
  count, per-table linked/NULL counts, and explicitly names any decision_record
  whose `sample_id` resolves to no sample (so the gap is never silent).

### `updated_at` trigger — deliberate deviation
The spec asked for an `updated_at` trigger "consistent with however other tables
do it … do not invent a new pattern if one already exists." **No `updated_at`
trigger exists anywhere in this repo** — every table sets `updated_at = now()`
manually inside its SECURITY DEFINER RPCs. So `projects` follows that same
convention (no trigger; `updated_at` defaults to `now()` and is bumped by future
mutation RPCs). Adding a `moddatetime`/generic trigger would have *introduced* a
new pattern, which the instruction told me not to do.

### Codebase rename pass (DB-facing references)
All DB-column/RPC-argument references to the renamed columns were updated; zero
remain (`grep` for `'project_name'` / `'project_id'` / `target_project_id` in
`src/` + `supabase/functions/` returns nothing):
- `src/app/lib/db/concepts.ts` — `row.project_name → row.concept_folder_name`
  (4×), insert `project_name → concept_folder_name`, `.select('project_name…')`
  (2×) and the error-probe string; evidence: `row.project_id → row.sample_id`,
  `.eq('project_id' → .eq('sample_id'`, RPC arg `target_project_id → target_sample_id`.
- `supabase/functions/generate-concept-images/index.ts` — `.eq('project_name' →
  .eq('concept_folder_name'`, insert `project_name → concept_folder_name`.
- `src/app/lib/report-evidence-source.ts` — local `projectId` params renamed to
  `sampleId` (cosmetic clarity; this value was always a sample id).

**Scoping decision (intentional):** the camelCase TS *model* fields
`ConceptTest.projectName` and `EvidenceBundleRecord.projectId` were **kept** and
mapped at the DB boundary. `projectName` is an *overloaded* identifier — it also
denotes the **real project's display name** (`status.projectName`,
`workflow.projectName`), which is the very thing this build creates. A blanket
camelCase rename would have corrupted that feature. Only the DB-facing strings
needed changing for correctness, and those are all done.

---

## Part 2 — Resolver `src/app/lib/project-identity.ts`

Single source of truth replacing the duplicated `subCategory` parsing:
- `parseBatchSelection(subCategory)` / `encodeBatchSelection(batchId)` — the one
  parser/encoder for the `batch:<id>` selection string.
- `computeFallbackProjectName(fileName, foodTypeSlug)` — shared legacy
  `pickProjectName` fallback for unassigned batches.
- `resolveProjectIdentity(supabase, { batchId?, projectId? })` → one canonical
  `ProjectIdentity` ({ projectId, projectName, foodTypeId, foodTypeSlug,
  activeBatchId, status }). Handles: batch→real project, batch→unassigned
  (legacy/dead, returns `status: 'unassigned'` — never throws), direct projectId
  (+ most-recent batch), and invalid/missing ids (safe unassigned).
- **Tests** `src/app/lib/project-identity.test.ts` — 9 tests covering all four
  paths + the parse/encode/fallback helpers. All pass.

---

## Part 3 — UI wiring

- **3a** — replaced the inline `subCategory.startsWith('batch:')` parsing in
  **all 10 sites across 8 files** (the discovery doc listed 4; a re-grep found
  more): main-layout (×2), project-header, stage4-enhanced, project-command-center,
  stage1-instrumental, commercialization-report-page, survey-analysis,
  admin-config (×2). All now call `parseBatchSelection`. Inline `batch:${id}`
  encodes replaced with `encodeBatchSelection` (main-layout, project-command-center,
  overview-dashboard). Re-grep confirms only `project-identity.ts` retains the literal.
- **3b** — `FoodTypeContext` selection now **persists to localStorage** and
  restores on reload (fixes discovery §C5 "lost on reload"). The
  `/project/:batchId` route remains source-of-truth: the existing effect in
  ProjectCommandCenter writes the route param into the context (route → context,
  one direction); the context persists; nothing reads the persisted value back to
  drive the route, so there is no update loop.
- **3c** — sidebar batch rows now show the **real `projects.name`** when a batch is
  linked, falling back to **"Unassigned: {fileName}"** (italic/muted) for legacy
  batches, with an **"Unassigned batches" separator** between the two groups.
  Required adding `projectId`/`projectName` to `ImportBatchRecord` +
  `fetchImportBatches` (via the existing rich/fallback select pattern, so it is
  safe both before and after the migration is applied).
- **3d** — project header now shows a **"Current project"** label + the real
  project name, and renders an explicit **unassigned state** ("No project assigned
  to this batch yet" + a disabled "Assign project" stub) instead of passing the
  computed fallback off as a real project.
- **3e** — `/project` with nothing in scope now renders a **ProjectPicker**: a
  card list of live (active) projects to open, plus a visible **count of batches
  not yet linked to a project**, and a CTA to import/start a new one (replacing the
  bare empty state, which only appeared in a rarely-hit branch).
- **3f** — audited `/stage1`, `/survey-analysis`, `/decision` (stage4-enhanced),
  `/concept-testing`, `/report`: all batch-scoped pages read scope from the shared
  `useFoodType()` context via `parseBatchSelection`. `concept-testing` is not
  batch-scoped (keyed by food-type slug) and never had divergent parsing — nothing
  to fix.

---

## Verification

- `tsc --noEmit` — **passes** (run after each part).
- `vitest run` — **352 passed, 5 skipped** (the 5 skips are RLS-isolation tests
  that need a live DB; unrelated).
- `vite build` — **passes** (`✓ built in 9.46s`).
- No remaining `grep` hits for `'project_name'` / `'project_id'` /
  `target_project_id` (DB strings) in `src/` or `supabase/functions/`.

---

## Post-apply verification (CONFIRMED, live linked DB)

Migration `20260625000000` recorded as applied (local + remote in sync). Counts:

| Check | Result |
|---|---|
| projects created | **2** — "Cheese — June 2026", "Bread — June 2026" |
| import_batches with project_id | **2** |
| import_batches still NULL (dead/legacy) | **13** |
| instrumental_samples linked | **24** (12 Bread + 12 Cheese) |
| decision_records linked | **14 of 15** |
| commercialization_reports linked | **25** (all) |
| products linked | **24** |
| concept_tests linked | **0** (intentionally not backfilled — no batch FK) |

Column renames confirmed live: `evidence_bundles.sample_id` exists / `project_id`
gone; `concept_tests.concept_folder_name` + `concept_image_generations.concept_folder_name`
exist; the `create_evidence_bundle` RPC parameter is `target_sample_id`.

## Deferred / known gaps (so nothing is silent)

1. **1 unresolvable decision_record — stays `project_id NULL`.**
   `id = 22a2ef22-85a4-4fad-bc26-a42aa0bf2bf4`, `sample_id = D1`,
   `sample_name = "Dairy Control 1"`, `decision = GO`. Its text `sample_id` (D1)
   matches no `instrumental_samples` row, so it cannot be backfilled — exactly the
   1 the discovery doc flagged. Left NULL by design.

2. **"Assign project" action is a disabled stub** in the project header — there is
   no UI yet to (re)assign a batch to a project or to create a project for a
   legacy batch. Flagged, not hidden.

3. **Deploy ordering — ACTION REQUIRED.** The migration is now live on the shared
   DB and renames columns the app reads (`concept_tests.concept_folder_name`,
   `evidence_bundles.sample_id`, RPC `target_sample_id`). **The matching app code
   in this branch must be deployed now** — until it is, the *currently deployed*
   (old) app will fail on concept-image generation and evidence-bundle creation,
   because it still references the old column/param names. This build's code is
   ready; it just needs to ship.
