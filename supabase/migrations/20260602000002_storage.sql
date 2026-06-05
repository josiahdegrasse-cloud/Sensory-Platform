INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'concept-images',
  'concept-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "admins_upload_concept_images" ON storage.objects;
CREATE POLICY "admins_upload_concept_images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'concept-images' AND is_admin());

DROP POLICY IF EXISTS "admins_delete_concept_images" ON storage.objects;
CREATE POLICY "admins_delete_concept_images" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'concept-images' AND is_admin());

DROP POLICY IF EXISTS "authenticated_view_concept_images" ON storage.objects;
CREATE POLICY "authenticated_view_concept_images" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'concept-images');
