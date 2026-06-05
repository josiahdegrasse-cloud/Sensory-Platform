-- Concept Lab platform layer: settings, project folders, generated image
-- history, storage-backed assets, approvals, and cost tracking.

ALTER TABLE public.concept_tests
  DROP CONSTRAINT IF EXISTS concept_tests_status_check;

ALTER TABLE public.concept_tests
  ADD CONSTRAINT concept_tests_status_check
  CHECK (status IN ('draft', 'review', 'approved', 'active', 'completed', 'archived'));

ALTER TABLE public.concept_tests
  ADD COLUMN IF NOT EXISTS project_name text DEFAULT 'Project 1',
  ADD COLUMN IF NOT EXISTS food_type_slug text DEFAULT '',
  ADD COLUMN IF NOT EXISTS generated_image_ids uuid[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS approval_notes text DEFAULT '',
  ADD COLUMN IF NOT EXISTS launched_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE TABLE IF NOT EXISTS public.concept_generation_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  active boolean NOT NULL DEFAULT true,
  default_image_count integer NOT NULL DEFAULT 4 CHECK (default_image_count BETWEEN 1 AND 4),
  max_images_per_concept integer NOT NULL DEFAULT 4 CHECK (max_images_per_concept BETWEEN 1 AND 8),
  default_quality text NOT NULL DEFAULT 'medium' CHECK (default_quality IN ('low', 'medium', 'high', 'auto')),
  default_model text NOT NULL DEFAULT 'gpt-image-1.5',
  estimated_cost_per_image numeric(8, 4) NOT NULL DEFAULT 0.034,
  monthly_budget numeric(10, 2) NOT NULL DEFAULT 50,
  prompt_style text NOT NULL DEFAULT 'balanced' CHECK (prompt_style IN ('balanced', 'premium', 'natural', 'family', 'foodservice', 'clean-label')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS one_active_concept_generation_setting
  ON public.concept_generation_settings (active)
  WHERE active;

INSERT INTO public.concept_generation_settings (
  active,
  default_image_count,
  max_images_per_concept,
  default_quality,
  default_model,
  estimated_cost_per_image,
  monthly_budget,
  prompt_style
)
SELECT true, 4, 4, 'medium', 'gpt-image-1.5', 0.034, 50, 'balanced'
WHERE NOT EXISTS (
  SELECT 1 FROM public.concept_generation_settings WHERE active = true
);

CREATE TABLE IF NOT EXISTS public.concept_image_generations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  concept_test_id uuid REFERENCES public.concept_tests(id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  project_name text DEFAULT 'Project 1',
  food_type_slug text DEFAULT '',
  concept_name text DEFAULT '',
  mode text NOT NULL DEFAULT 'packaging',
  prompt text NOT NULL DEFAULT '',
  prompt_style text NOT NULL DEFAULT 'balanced',
  model text NOT NULL DEFAULT 'gpt-image-1.5',
  quality text NOT NULL DEFAULT 'medium',
  requested_count integer NOT NULL DEFAULT 4,
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('queued', 'generating', 'completed', 'failed')),
  error_message text,
  estimated_cost numeric(10, 4) DEFAULT 0,
  concept_snapshot jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.concept_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  generation_id uuid REFERENCES public.concept_image_generations(id) ON DELETE CASCADE,
  concept_test_id uuid REFERENCES public.concept_tests(id) ON DELETE SET NULL,
  image_url text NOT NULL,
  storage_path text,
  selected_for_panelists boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  mode text DEFAULT 'packaging',
  prompt text DEFAULT '',
  model text DEFAULT 'gpt-image-1.5',
  quality text DEFAULT 'medium',
  performance_summary jsonb NOT NULL DEFAULT '{}',
  archived_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_concept_tests_project ON public.concept_tests (project_name);
CREATE INDEX IF NOT EXISTS idx_concept_tests_food_type ON public.concept_tests (food_type_slug);
CREATE INDEX IF NOT EXISTS idx_concept_image_generations_created_by ON public.concept_image_generations (created_by);
CREATE INDEX IF NOT EXISTS idx_concept_image_generations_project ON public.concept_image_generations (project_name);
CREATE INDEX IF NOT EXISTS idx_concept_images_generation ON public.concept_images (generation_id);
CREATE INDEX IF NOT EXISTS idx_concept_images_concept_test ON public.concept_images (concept_test_id);

ALTER TABLE public.concept_generation_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.concept_image_generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.concept_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS concept_generation_settings_select_admin ON public.concept_generation_settings;
CREATE POLICY concept_generation_settings_select_admin ON public.concept_generation_settings
  FOR SELECT TO authenticated
  USING (is_admin());

DROP POLICY IF EXISTS concept_generation_settings_admin_all ON public.concept_generation_settings;
CREATE POLICY concept_generation_settings_admin_all ON public.concept_generation_settings
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS concept_image_generations_select_admin ON public.concept_image_generations;
CREATE POLICY concept_image_generations_select_admin ON public.concept_image_generations
  FOR SELECT TO authenticated
  USING (is_admin());

DROP POLICY IF EXISTS concept_image_generations_admin_all ON public.concept_image_generations;
CREATE POLICY concept_image_generations_admin_all ON public.concept_image_generations
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS concept_images_select_authenticated ON public.concept_images;
CREATE POLICY concept_images_select_authenticated ON public.concept_images
  FOR SELECT TO authenticated
  USING (
    is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.concept_tests ct
      WHERE ct.id = concept_images.concept_test_id
        AND (
          ct.status = 'active'
          OR ct.assigned_panelist_ids @> ARRAY[auth.uid()::text]
        )
    )
  );

DROP POLICY IF EXISTS concept_images_admin_all ON public.concept_images;
CREATE POLICY concept_images_admin_all ON public.concept_images
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());
