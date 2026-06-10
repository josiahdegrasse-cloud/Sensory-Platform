-- ════════════════════════════════════════════════════════════════════════════
-- Storage: per-organization isolation for concept images
-- ════════════════════════════════════════════════════════════════════════════
-- Table RLS does not cover Storage objects, so concept images in the
-- `concept-images` bucket need their own isolation. These additive RESTRICTIVE
-- policies AND on top of the existing admin/panelist view + upload policies:
-- an authenticated user may read/modify/delete a concept-images object only when
-- the matching public.concept_images row belongs to their organization.
--
-- Keyed off concept_images.org_id (joined by storage_path) rather than the
-- object path, so it covers existing objects with no backfill and needs no
-- change to the upload path. Uploads still happen via the edge function's
-- service-role client (which bypasses RLS), so INSERT is intentionally left to
-- the existing admin upload policy.
--
-- The `bucket_id <> 'concept-images' OR …` guard means any OTHER storage bucket
-- is completely unaffected by these policies.
--
-- SAFETY: not run against a live DB. Apply to a preview/branch DB first.
-- ════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "concept_images_org_isolation_select" ON storage.objects;
CREATE POLICY "concept_images_org_isolation_select" ON storage.objects
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (
    bucket_id <> 'concept-images'
    OR EXISTS (
      SELECT 1 FROM public.concept_images ci
      WHERE ci.storage_path = storage.objects.name
        AND ci.org_id = public.current_org_id()
    )
  );

DROP POLICY IF EXISTS "concept_images_org_isolation_update" ON storage.objects;
CREATE POLICY "concept_images_org_isolation_update" ON storage.objects
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (
    bucket_id <> 'concept-images'
    OR EXISTS (
      SELECT 1 FROM public.concept_images ci
      WHERE ci.storage_path = storage.objects.name
        AND ci.org_id = public.current_org_id()
    )
  )
  WITH CHECK (
    bucket_id <> 'concept-images'
    OR EXISTS (
      SELECT 1 FROM public.concept_images ci
      WHERE ci.storage_path = storage.objects.name
        AND ci.org_id = public.current_org_id()
    )
  );

DROP POLICY IF EXISTS "concept_images_org_isolation_delete" ON storage.objects;
CREATE POLICY "concept_images_org_isolation_delete" ON storage.objects
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (
    bucket_id <> 'concept-images'
    OR EXISTS (
      SELECT 1 FROM public.concept_images ci
      WHERE ci.storage_path = storage.objects.name
        AND ci.org_id = public.current_org_id()
    )
  );
