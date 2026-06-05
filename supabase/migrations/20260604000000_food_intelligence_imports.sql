-- Persistent food intelligence and instrumental import data.

CREATE TABLE IF NOT EXISTS public.food_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  label text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted')),
  source text NOT NULL DEFAULT 'import' CHECK (source IN ('system', 'import', 'manual')),
  aliases text[] NOT NULL DEFAULT '{}',
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.food_types
  DROP CONSTRAINT IF EXISTS food_types_status_check;

ALTER TABLE public.food_types
  ADD CONSTRAINT food_types_status_check
  CHECK (status IN ('active', 'archived', 'deleted'));

CREATE TABLE IF NOT EXISTS public.import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  food_type_id uuid NOT NULL REFERENCES public.food_types(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted')),
  row_count integer NOT NULL DEFAULT 0,
  recognized_columns text[] NOT NULL DEFAULT '{}',
  ignored_columns text[] NOT NULL DEFAULT '{}',
  detection_confidence numeric NOT NULL DEFAULT 0,
  imported_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  imported_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.instrumental_samples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_batch_id uuid NOT NULL REFERENCES public.import_batches(id) ON DELETE CASCADE,
  food_type_id uuid NOT NULL REFERENCES public.food_types(id) ON DELETE CASCADE,
  sample_id text NOT NULL,
  sample_name text,
  category text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (import_batch_id, sample_id)
);

CREATE TABLE IF NOT EXISTS public.e_tongue_measurements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sample_id uuid NOT NULL REFERENCES public.instrumental_samples(id) ON DELETE CASCADE,
  sourness numeric NOT NULL DEFAULT 0,
  bitterness numeric NOT NULL DEFAULT 0,
  saltiness numeric NOT NULL DEFAULT 0,
  umami numeric NOT NULL DEFAULT 0,
  sweetness numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gcms_compounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sample_id uuid NOT NULL REFERENCES public.instrumental_samples(id) ON DELETE CASCADE,
  name text NOT NULL,
  concentration numeric NOT NULL DEFAULT 0,
  aroma text NOT NULL DEFAULT 'unknown',
  threshold numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.composition_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sample_id uuid NOT NULL REFERENCES public.instrumental_samples(id) ON DELETE CASCADE,
  protein numeric NOT NULL DEFAULT 0,
  fat numeric NOT NULL DEFAULT 0,
  moisture numeric NOT NULL DEFAULT 0,
  ph numeric NOT NULL DEFAULT 0,
  salt_content numeric NOT NULL DEFAULT 0,
  calcium_mg numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sample_id)
);

CREATE TABLE IF NOT EXISTS public.audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_food_types_status ON public.food_types(status);
CREATE INDEX IF NOT EXISTS idx_import_batches_food_type ON public.import_batches(food_type_id);
CREATE INDEX IF NOT EXISTS idx_instrumental_samples_food_type ON public.instrumental_samples(food_type_id);
CREATE INDEX IF NOT EXISTS idx_instrumental_samples_import_batch ON public.instrumental_samples(import_batch_id);
CREATE INDEX IF NOT EXISTS idx_e_tongue_sample ON public.e_tongue_measurements(sample_id);
CREATE INDEX IF NOT EXISTS idx_gcms_sample ON public.gcms_compounds(sample_id);
CREATE INDEX IF NOT EXISTS idx_composition_sample ON public.composition_profiles(sample_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_entity ON public.audit_events(entity_type, entity_id);

ALTER TABLE public.food_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instrumental_samples ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.e_tongue_measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gcms_compounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.composition_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS food_types_select_authenticated ON public.food_types;
CREATE POLICY food_types_select_authenticated ON public.food_types
  FOR SELECT TO authenticated
  USING (status = 'active' OR is_admin());

DROP POLICY IF EXISTS food_types_admin_all ON public.food_types;
CREATE POLICY food_types_admin_all ON public.food_types
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS import_batches_select_authenticated ON public.import_batches;
CREATE POLICY import_batches_select_authenticated ON public.import_batches
  FOR SELECT TO authenticated
  USING (status = 'active' OR is_admin());

DROP POLICY IF EXISTS import_batches_admin_all ON public.import_batches;
CREATE POLICY import_batches_admin_all ON public.import_batches
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS instrumental_samples_select_authenticated ON public.instrumental_samples;
CREATE POLICY instrumental_samples_select_authenticated ON public.instrumental_samples
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.import_batches b
      WHERE b.id = import_batch_id AND (b.status = 'active' OR is_admin())
    )
  );

DROP POLICY IF EXISTS instrumental_samples_admin_all ON public.instrumental_samples;
CREATE POLICY instrumental_samples_admin_all ON public.instrumental_samples
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS e_tongue_select_authenticated ON public.e_tongue_measurements;
CREATE POLICY e_tongue_select_authenticated ON public.e_tongue_measurements
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.instrumental_samples s
      JOIN public.import_batches b ON b.id = s.import_batch_id
      WHERE s.id = e_tongue_measurements.sample_id AND (b.status = 'active' OR is_admin())
    )
  );

DROP POLICY IF EXISTS e_tongue_admin_all ON public.e_tongue_measurements;
CREATE POLICY e_tongue_admin_all ON public.e_tongue_measurements
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS gcms_select_authenticated ON public.gcms_compounds;
CREATE POLICY gcms_select_authenticated ON public.gcms_compounds
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.instrumental_samples s
      JOIN public.import_batches b ON b.id = s.import_batch_id
      WHERE s.id = gcms_compounds.sample_id AND (b.status = 'active' OR is_admin())
    )
  );

DROP POLICY IF EXISTS gcms_admin_all ON public.gcms_compounds;
CREATE POLICY gcms_admin_all ON public.gcms_compounds
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS composition_select_authenticated ON public.composition_profiles;
CREATE POLICY composition_select_authenticated ON public.composition_profiles
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.instrumental_samples s
      JOIN public.import_batches b ON b.id = s.import_batch_id
      WHERE s.id = composition_profiles.sample_id AND (b.status = 'active' OR is_admin())
    )
  );

DROP POLICY IF EXISTS composition_admin_all ON public.composition_profiles;
CREATE POLICY composition_admin_all ON public.composition_profiles
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS audit_events_select_admin ON public.audit_events;
CREATE POLICY audit_events_select_admin ON public.audit_events
  FOR SELECT TO authenticated
  USING (is_admin());

DROP POLICY IF EXISTS audit_events_insert_admin ON public.audit_events;
CREATE POLICY audit_events_insert_admin ON public.audit_events
  FOR INSERT TO authenticated
  WITH CHECK (is_admin());

INSERT INTO public.food_types (slug, label, status, source, aliases)
VALUES
  ('cheese', 'Cheese', 'active', 'system', ARRAY['dairy', 'milk', 'cream', 'butter', 'pbca']),
  ('bread', 'Bread', 'active', 'system', ARRAY['bakery', 'loaf', 'sourdough', 'rye', 'brioche'])
ON CONFLICT (slug) DO NOTHING;
