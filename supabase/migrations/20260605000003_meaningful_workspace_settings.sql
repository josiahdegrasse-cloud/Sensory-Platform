ALTER TABLE public.workspace_settings
  ADD COLUMN IF NOT EXISTS default_panel_size integer NOT NULL DEFAULT 24,
  ADD COLUMN IF NOT EXISTS require_hedonic_section boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS require_intensity_section boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS require_emotion_section boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_panelist_comments boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS require_all_samples_before_submit boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS auto_create_food_types boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS auto_create_surveys_from_imports boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS require_import_review boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS duplicate_sample_policy text NOT NULL DEFAULT 'skip',
  ADD COLUMN IF NOT EXISTS require_panelist_id boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_panelists_view_history boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS inactive_panelist_days integer NOT NULL DEFAULT 90,
  ADD COLUMN IF NOT EXISTS concept_max_generations_per_concept integer NOT NULL DEFAULT 12,
  ADD COLUMN IF NOT EXISTS concept_monthly_budget_cents integer NOT NULL DEFAULT 2500,
  ADD COLUMN IF NOT EXISTS concept_require_approval boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS decision_go_threshold integer NOT NULL DEFAULT 75,
  ADD COLUMN IF NOT EXISTS decision_stop_threshold integer NOT NULL DEFAULT 45,
  ADD COLUMN IF NOT EXISTS decision_min_responses integer NOT NULL DEFAULT 12,
  ADD COLUMN IF NOT EXISTS decision_lock_confirmed boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS anonymize_panelists_in_reports boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS export_format text NOT NULL DEFAULT 'xlsx',
  ADD COLUMN IF NOT EXISTS report_footer text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS notify_on_import boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_on_completion_target boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_on_generation_failure boolean NOT NULL DEFAULT true;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'workspace_settings_default_panel_size_check'
  ) THEN
    ALTER TABLE public.workspace_settings
      ADD CONSTRAINT workspace_settings_default_panel_size_check CHECK (default_panel_size BETWEEN 1 AND 500);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'workspace_settings_duplicate_sample_policy_check'
  ) THEN
    ALTER TABLE public.workspace_settings
      ADD CONSTRAINT workspace_settings_duplicate_sample_policy_check CHECK (duplicate_sample_policy IN ('skip', 'rename', 'replace'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'workspace_settings_inactive_panelist_days_check'
  ) THEN
    ALTER TABLE public.workspace_settings
      ADD CONSTRAINT workspace_settings_inactive_panelist_days_check CHECK (inactive_panelist_days BETWEEN 1 AND 730);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'workspace_settings_concept_limits_check'
  ) THEN
    ALTER TABLE public.workspace_settings
      ADD CONSTRAINT workspace_settings_concept_limits_check CHECK (
        concept_max_generations_per_concept BETWEEN 1 AND 100
        AND concept_monthly_budget_cents BETWEEN 0 AND 1000000
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'workspace_settings_decision_thresholds_check'
  ) THEN
    ALTER TABLE public.workspace_settings
      ADD CONSTRAINT workspace_settings_decision_thresholds_check CHECK (
        decision_stop_threshold BETWEEN 0 AND 100
        AND decision_go_threshold BETWEEN 0 AND 100
        AND decision_stop_threshold < decision_go_threshold
        AND decision_min_responses BETWEEN 1 AND 500
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'workspace_settings_export_format_check'
  ) THEN
    ALTER TABLE public.workspace_settings
      ADD CONSTRAINT workspace_settings_export_format_check CHECK (export_format IN ('xlsx', 'csv', 'pdf'));
  END IF;
END $$;
