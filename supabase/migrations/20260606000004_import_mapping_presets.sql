CREATE TABLE IF NOT EXISTS public.import_mapping_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  mappings jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT import_mapping_presets_name_length CHECK (char_length(name) BETWEEN 1 AND 80),
  CONSTRAINT import_mapping_presets_mappings_array CHECK (jsonb_typeof(mappings) = 'array')
);

ALTER TABLE public.import_mapping_presets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS import_mapping_presets_admin_select ON public.import_mapping_presets;
CREATE POLICY import_mapping_presets_admin_select ON public.import_mapping_presets
  FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS import_mapping_presets_admin_insert ON public.import_mapping_presets;
CREATE POLICY import_mapping_presets_admin_insert ON public.import_mapping_presets
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() AND created_by = auth.uid());

DROP POLICY IF EXISTS import_mapping_presets_admin_update ON public.import_mapping_presets;
CREATE POLICY import_mapping_presets_admin_update ON public.import_mapping_presets
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS import_mapping_presets_admin_delete ON public.import_mapping_presets;
CREATE POLICY import_mapping_presets_admin_delete ON public.import_mapping_presets
  FOR DELETE TO authenticated
  USING (public.is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_mapping_presets TO authenticated;
