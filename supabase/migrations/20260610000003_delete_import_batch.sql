-- ════════════════════════════════════════════════════════════════════════════
-- Permanent (hard) delete for an import batch
-- ════════════════════════════════════════════════════════════════════════════
-- The Configure > Imports delete action was a soft delete (status='deleted',
-- restorable). This adds a true hard delete: the batch row and its products are
-- removed entirely (instrumental_samples + their measurements cascade from the
-- batch via ON DELETE CASCADE; products are ON DELETE SET NULL so we remove them
-- explicitly to match the prior soft-delete semantics).
--
-- SECURITY DEFINER + org-guarded (bypasses RLS, so scope to the caller's org),
-- and writes an audit_events row.
--
-- SAFETY: not run against a live DB. Apply to a preview/branch DB first, then
-- prod (supabase db push).
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.delete_import_batch(target_batch_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only active administrators can delete import batches';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.import_batches
    WHERE id = target_batch_id AND org_id = public.current_org_id()
  ) THEN
    RAISE EXCEPTION 'Import batch not found';
  END IF;

  -- products.source_import_batch_id is ON DELETE SET NULL, so remove them first.
  DELETE FROM public.products WHERE source_import_batch_id = target_batch_id;

  -- instrumental_samples (and e_tongue/gcms/composition under them) cascade.
  DELETE FROM public.import_batches WHERE id = target_batch_id;

  INSERT INTO public.audit_events (actor_id, event_type, entity_type, entity_id, metadata)
  VALUES (auth.uid(), 'import_batch_deleted', 'import_batches', target_batch_id, '{}'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.delete_import_batch(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_import_batch(uuid) TO authenticated;
