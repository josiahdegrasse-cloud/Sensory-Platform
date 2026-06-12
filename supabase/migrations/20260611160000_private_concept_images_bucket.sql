-- Concept images must be served through authenticated signed URLs.
UPDATE storage.buckets
SET public = false
WHERE id = 'concept-images';
