CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY profiles_select_own ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY profiles_select_admin ON public.profiles
  FOR SELECT TO authenticated
  USING (is_admin());

CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY profiles_update_admin ON public.profiles
  FOR UPDATE TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY profiles_delete_admin ON public.profiles
  FOR DELETE TO authenticated
  USING (is_admin());

-- products
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY products_select_authenticated ON public.products
  FOR SELECT TO authenticated
  USING (status = 'active' OR is_admin());

CREATE POLICY products_admin_all ON public.products
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- responses
ALTER TABLE public.responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY responses_select_own ON public.responses
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY responses_select_admin ON public.responses
  FOR SELECT TO authenticated
  USING (is_admin());

CREATE POLICY responses_insert_own ON public.responses
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY responses_update_own ON public.responses
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY responses_update_admin ON public.responses
  FOR UPDATE TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY responses_delete_admin ON public.responses
  FOR DELETE TO authenticated
  USING (is_admin());

-- templates
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY templates_select_authenticated ON public.templates
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY templates_admin_all ON public.templates
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- concept_tests
ALTER TABLE public.concept_tests ENABLE ROW LEVEL SECURITY;

CREATE POLICY concept_tests_select_admin ON public.concept_tests
  FOR SELECT TO authenticated
  USING (is_admin());

CREATE POLICY concept_tests_select_panelist ON public.concept_tests
  FOR SELECT TO authenticated
  USING (
    status = 'active'
    OR assigned_panelist_ids @> ARRAY[auth.uid()::text]
  );

CREATE POLICY concept_tests_admin_all ON public.concept_tests
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- concept_responses
ALTER TABLE public.concept_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY concept_responses_select_own ON public.concept_responses
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY concept_responses_select_admin ON public.concept_responses
  FOR SELECT TO authenticated
  USING (is_admin());

CREATE POLICY concept_responses_insert_own ON public.concept_responses
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY concept_responses_update_own ON public.concept_responses
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY concept_responses_update_admin ON public.concept_responses
  FOR UPDATE TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY concept_responses_delete_admin ON public.concept_responses
  FOR DELETE TO authenticated
  USING (is_admin());
