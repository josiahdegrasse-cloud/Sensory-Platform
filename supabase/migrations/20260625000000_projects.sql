-- ════════════════════════════════════════════════════════════════════════════
-- Project identity — promote "project" from a computed UI label to a real entity
-- ════════════════════════════════════════════════════════════════════════════
-- Background (see PROJECT_IDENTITY_DISCOVERY.md): "project" was a derived value
-- (pickProjectName() in src/app/lib/project-status.ts) mapping 1:1 to an active
-- import_batches row. A real project can span multiple import_batches over time
-- (reformulation rounds), which a derived value can't represent — so it becomes
-- a first-class table here.
--
-- Scope is intentionally narrow: only the 2 currently-active batches become real
-- projects. All 13 deleted/dead batches stay project_id NULL — no groupings are
-- invented for them.
--
-- NOTE on updated_at: this repo has NO updated_at trigger function (verified by
-- grepping every migration). Existing tables with updated_at (food_types,
-- commercialization_reports, …) set it manually via `updated_at = now()` inside
-- their SECURITY DEFINER RPCs. To avoid inventing a new pattern, projects follows
-- that same convention — updated_at defaults to now() and is bumped manually by
-- any future mutation RPC. No trigger is added.
--
-- SAFETY: This renames live columns (evidence_bundles.project_id,
-- concept_tests.project_name, concept_image_generations.project_name) and must be
-- deployed together with the matching application-code rename pass. Apply to a
-- Supabase preview/branch DB first and run the verification block at the bottom.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── 1a. projects table ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  food_type_id uuid NOT NULL REFERENCES public.food_types(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted')),
  started_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  org_id uuid REFERENCES public.organizations(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_projects_food_type ON public.projects (food_type_id);
CREATE INDEX IF NOT EXISTS idx_projects_org ON public.projects (org_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects (status);

-- ─── 1b. RLS — the documented two-layer pattern (permissive + RESTRICTIVE org) ─
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS projects_select_authenticated ON public.projects;
CREATE POLICY projects_select_authenticated ON public.projects
  FOR SELECT TO authenticated
  USING (status <> 'deleted' OR is_admin());

DROP POLICY IF EXISTS projects_admin_all ON public.projects;
CREATE POLICY projects_admin_all ON public.projects
  FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS org_isolation ON public.projects;
CREATE POLICY org_isolation ON public.projects AS RESTRICTIVE FOR ALL TO authenticated
  USING (org_id = public.current_org_id())
  WITH CHECK (org_id = public.current_org_id());

-- Auto-stamp org_id on insert, matching every other tenant table.
DROP TRIGGER IF EXISTS trg_set_org_id ON public.projects;
CREATE TRIGGER trg_set_org_id BEFORE INSERT ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.set_org_id();

-- ─── 1c. project_id FK on every directly project-scoped table ─────────────────
ALTER TABLE public.import_batches
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;
ALTER TABLE public.instrumental_samples
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;
ALTER TABLE public.decision_records
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;
ALTER TABLE public.commercialization_reports
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;
ALTER TABLE public.concept_tests
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_import_batches_project ON public.import_batches (project_id);
CREATE INDEX IF NOT EXISTS idx_instrumental_samples_project ON public.instrumental_samples (project_id);
CREATE INDEX IF NOT EXISTS idx_decision_records_project ON public.decision_records (project_id);
CREATE INDEX IF NOT EXISTS idx_commercialization_reports_project ON public.commercialization_reports (project_id);
CREATE INDEX IF NOT EXISTS idx_products_project ON public.products (project_id);
CREATE INDEX IF NOT EXISTS idx_concept_tests_project_id ON public.concept_tests (project_id);

-- ─── 1d. Rename the colliding "project" columns ───────────────────────────────
-- evidence_bundles.project_id actually holds a sample_id (e.g. S4, S12), per
-- src/app/lib/report-evidence-source.ts. Rename column + its UNIQUE constraints
-- + its index so nothing keeps the misleading "project" name.
ALTER TABLE public.evidence_bundles RENAME COLUMN project_id TO sample_id;

-- RENAME CONSTRAINT renames the backing unique index alongside the constraint,
-- with no window where the uniqueness guarantee is dropped.
ALTER TABLE public.evidence_bundles
  RENAME CONSTRAINT evidence_bundles_project_id_version_key
  TO evidence_bundles_sample_id_version_key;
ALTER TABLE public.evidence_bundles
  RENAME CONSTRAINT evidence_bundles_project_id_source_data_version_key
  TO evidence_bundles_sample_id_source_data_version_key;

-- Plain (non-constraint) indexes: rename so the name matches the new column.
ALTER INDEX IF EXISTS idx_evidence_bundles_project RENAME TO idx_evidence_bundles_sample;
ALTER INDEX IF EXISTS idx_evidence_bundles_source_data RENAME TO idx_evidence_bundles_sample_source_data;

-- concept_tests.project_name / concept_image_generations.project_name is a
-- Concept Lab folder label (default 'Project 1'), unrelated to the real entity.
ALTER TABLE public.concept_tests RENAME COLUMN project_name TO concept_folder_name;
ALTER TABLE public.concept_image_generations RENAME COLUMN project_name TO concept_folder_name;

ALTER INDEX IF EXISTS idx_concept_tests_project RENAME TO idx_concept_tests_concept_folder;
ALTER INDEX IF EXISTS idx_concept_image_generations_project RENAME TO idx_concept_image_generations_concept_folder;

-- create_evidence_bundle() referenced project_id internally. Recreate it 1:1 with
-- the column renamed to sample_id (signature/behaviour otherwise identical). The
-- parameter is renamed target_sample_id; callers (PostgREST named args) are updated
-- in the same deploy. Postgres refuses to rename a parameter via CREATE OR REPLACE
-- (SQLSTATE 42P13), so the old definition is dropped first. The signature
-- (text,text,text,jsonb) is unchanged, so dependents/grants are reissued below.
DROP FUNCTION IF EXISTS public.create_evidence_bundle(text, text, text, jsonb);

CREATE FUNCTION public.create_evidence_bundle(
  target_sample_id text,
  target_schema_version text,
  target_source_data_version text,
  target_payload jsonb
)
RETURNS public.evidence_bundles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  existing_bundle public.evidence_bundles;
  next_version integer;
  created_bundle public.evidence_bundles;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only active administrators can create evidence bundles';
  END IF;

  IF NULLIF(trim(target_sample_id), '') IS NULL THEN
    RAISE EXCEPTION 'Sample id is required';
  END IF;

  SELECT *
  INTO existing_bundle
  FROM public.evidence_bundles
  WHERE sample_id = target_sample_id
    AND source_data_version = target_source_data_version
    AND org_id = public.current_org_id()
  LIMIT 1;

  IF FOUND THEN
    RETURN existing_bundle;
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('evidence-bundle:' || public.current_org_id()::text || ':' || target_sample_id, 0)
  );

  SELECT COALESCE(MAX(version), 0) + 1
  INTO next_version
  FROM public.evidence_bundles
  WHERE sample_id = target_sample_id
    AND org_id = public.current_org_id();

  INSERT INTO public.evidence_bundles (
    sample_id,
    version,
    schema_version,
    source_data_version,
    payload,
    created_by,
    org_id
  )
  VALUES (
    target_sample_id,
    next_version,
    target_schema_version,
    target_source_data_version,
    target_payload,
    auth.uid(),
    public.current_org_id()
  )
  RETURNING * INTO created_bundle;

  RETURN created_bundle;
END;
$$;

-- The old 4-arg signature is unchanged (text, text, text, jsonb) so CREATE OR
-- REPLACE swaps the body in place; grants from the original migration persist.
REVOKE ALL ON FUNCTION public.create_evidence_bundle(text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_evidence_bundle(text, text, text, jsonb) TO authenticated;

-- ─── 1e. Backfill ─────────────────────────────────────────────────────────────
-- Step 1: one project per currently-active batch. (Bread + Cheese — different
-- food types, legitimately separate projects.) Name = "{FoodType} — {Month YYYY}"
-- from the batch's imported_at. trim() strips to_char's blank-padding on Month.
INSERT INTO public.projects (name, food_type_id, started_at, org_id)
SELECT
  ft.label || ' — ' || trim(to_char(ib.imported_at, 'Month')) || ' ' || to_char(ib.imported_at, 'YYYY'),
  ib.food_type_id,
  ib.imported_at,
  ib.org_id
FROM public.import_batches ib
JOIN public.food_types ft ON ft.id = ib.food_type_id
WHERE ib.status = 'active';

-- Step 2: link each active batch to its new project. The active batches are one
-- per food type, so matching on food_type_id is unambiguous here.
UPDATE public.import_batches ib
SET project_id = p.id
FROM public.projects p
WHERE ib.food_type_id = p.food_type_id
  AND ib.status = 'active'
  AND ib.project_id IS NULL;

-- Step 3: cascade to instrumental_samples via batch.
UPDATE public.instrumental_samples s
SET project_id = ib.project_id
FROM public.import_batches ib
WHERE s.import_batch_id = ib.id
  AND ib.project_id IS NOT NULL;

-- Step 4: cascade to decision_records via the fragile text sample_id (best-effort;
-- 1 of 15 existing decisions has a sample_id that resolves to no sample — it is
-- intentionally left NULL and reported in the verification block).
UPDATE public.decision_records dr
SET project_id = s.project_id
FROM public.instrumental_samples s
WHERE dr.sample_id = s.sample_id
  AND s.project_id IS NOT NULL;

-- Step 5: cascade to commercialization_reports via the hard decision_record FK.
UPDATE public.commercialization_reports cr
SET project_id = dr.project_id
FROM public.decision_records dr
WHERE cr.decision_record_id = dr.id
  AND dr.project_id IS NOT NULL;

-- Step 6: cascade to products via source_import_batch_id where present. The ~57
-- products with a NULL source batch stay project_id NULL — not guessed.
UPDATE public.products pr
SET project_id = ib.project_id
FROM public.import_batches ib
WHERE pr.source_import_batch_id = ib.id
  AND ib.project_id IS NOT NULL;

-- concept_tests intentionally NOT backfilled: no existing FK to a batch, so every
-- existing row stays project_id NULL. Only future project-scoped creation sets it.

-- ─── Verification (the migration runner prints these; review before trusting) ──
-- Expected: 2 projects; 2 import_batches with project_id; 13 batches still NULL;
-- 24 instrumental_samples (12 Bread + 12 Cheese) linked; reports/products as the
-- live data allows; exactly 1 decision_record with an unresolvable sample_id.
DO $$
DECLARE
  v_projects int;
  v_batches_linked int;
  v_batches_null int;
  v_samples_linked int;
  v_decisions_linked int;
  v_decisions_total int;
  v_reports_linked int;
  v_products_linked int;
  v_orphan_decision text;
BEGIN
  SELECT count(*) INTO v_projects FROM public.projects;
  SELECT count(*) INTO v_batches_linked FROM public.import_batches WHERE project_id IS NOT NULL;
  SELECT count(*) INTO v_batches_null FROM public.import_batches WHERE project_id IS NULL;
  SELECT count(*) INTO v_samples_linked FROM public.instrumental_samples WHERE project_id IS NOT NULL;
  SELECT count(*) INTO v_decisions_linked FROM public.decision_records WHERE project_id IS NOT NULL;
  SELECT count(*) INTO v_decisions_total FROM public.decision_records;
  SELECT count(*) INTO v_reports_linked FROM public.commercialization_reports WHERE project_id IS NOT NULL;
  SELECT count(*) INTO v_products_linked FROM public.products WHERE project_id IS NOT NULL;

  RAISE NOTICE 'projects created: %', v_projects;
  RAISE NOTICE 'import_batches linked: % | still NULL: %', v_batches_linked, v_batches_null;
  RAISE NOTICE 'instrumental_samples linked: %', v_samples_linked;
  RAISE NOTICE 'decision_records linked: % of %', v_decisions_linked, v_decisions_total;
  RAISE NOTICE 'commercialization_reports linked: %', v_reports_linked;
  RAISE NOTICE 'products linked: %', v_products_linked;

  -- Explicitly surface any decision whose text sample_id resolves to NO
  -- instrumental_samples row at all (the discovery doc flagged exactly 1). These
  -- can never be backfilled and stay project_id NULL — print them so the gap is
  -- never silent.
  FOR v_orphan_decision IN
    SELECT dr.id::text || ' (sample_id=' || dr.sample_id || ', decision=' || dr.decision || ')'
    FROM public.decision_records dr
    WHERE NOT EXISTS (
      SELECT 1 FROM public.instrumental_samples s WHERE s.sample_id = dr.sample_id
    )
  LOOP
    RAISE NOTICE 'UNRESOLVED decision_record (sample_id matches no sample): %', v_orphan_decision;
  END LOOP;
END $$;
