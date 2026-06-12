-- Report template: per-tenant choice of commercialization-report PDF layout.
-- 'standard' keeps the existing editorial navy/blue layout; 'editorial-sage'
-- renders the New Food Innovation cream/sage masthead layout.
ALTER TABLE public.workspace_settings
  ADD COLUMN IF NOT EXISTS report_template text
    CHECK (report_template IN ('standard', 'editorial-sage'))
    DEFAULT 'standard';
