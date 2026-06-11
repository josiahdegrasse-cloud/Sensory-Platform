UPDATE storage.buckets
SET public = false
WHERE id = 'concept-images';

DROP POLICY IF EXISTS "authenticated_view_concept_images" ON storage.objects;
DROP POLICY IF EXISTS "assigned_view_concept_images" ON storage.objects;
CREATE POLICY "assigned_view_concept_images" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'concept-images'
    AND public.is_active_user()
    AND (
      public.is_admin()
      OR EXISTS (
        SELECT 1
        FROM public.concept_images ci
        JOIN public.concept_tests ct ON ct.id = ci.concept_test_id
        WHERE ci.storage_path = storage.objects.name
          AND ci.selected_for_panelists = true
          AND ct.status = 'active'
          AND ct.assigned_panelist_ids @> ARRAY[auth.uid()::text]
      )
    )
  );

DROP POLICY IF EXISTS concept_tests_select_panelist ON public.concept_tests;
CREATE POLICY concept_tests_select_panelist ON public.concept_tests
  FOR SELECT TO authenticated
  USING (
    public.is_active_user()
    AND status = 'active'
    AND assigned_panelist_ids @> ARRAY[auth.uid()::text]
  );

DROP POLICY IF EXISTS products_select_authenticated ON public.products;
CREATE POLICY products_select_authenticated ON public.products
  FOR SELECT TO authenticated
  USING (
    public.is_active_user()
    AND (
      public.is_admin()
      OR (
        status = 'active'
        AND (
          COALESCE(array_length(assigned_panelist_ids, 1), 0) = 0
          OR assigned_panelist_ids @> ARRAY[auth.uid()::text]
        )
      )
    )
  );

DROP POLICY IF EXISTS responses_insert_own ON public.responses;
CREATE POLICY responses_insert_own ON public.responses
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_active_user()
    AND auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.products p
      WHERE p.id = product_id
        AND p.status = 'active'
        AND (
          COALESCE(array_length(p.assigned_panelist_ids, 1), 0) = 0
          OR p.assigned_panelist_ids @> ARRAY[auth.uid()::text]
        )
    )
  );

DROP POLICY IF EXISTS concept_responses_insert_own ON public.concept_responses;
CREATE POLICY concept_responses_insert_own ON public.concept_responses
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_active_user()
    AND auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.concept_tests ct
      WHERE ct.id = concept_test_id
        AND ct.status = 'active'
        AND ct.assigned_panelist_ids @> ARRAY[auth.uid()::text]
    )
  );

