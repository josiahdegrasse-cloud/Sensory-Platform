-- ─── #2: Prevent panelists from self-escalating their role ────────────────────
-- Drop the overly permissive own-update policy and replace it with one that
-- only allows updating the `name` column (explicitly blocks role/panelist_id).
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;

CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id AND NOT is_admin())
  WITH CHECK (
    auth.uid() = id
    -- Prevent the user from changing their own role or panelist_id
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = role
    AND (SELECT panelist_id FROM public.profiles WHERE id = auth.uid()) IS NOT DISTINCT FROM panelist_id
  );

-- ─── #9: Prevent panelists from changing their own panelist_id ────────────────
-- The WITH CHECK above already blocks panelist_id changes.
-- This comment documents the intent explicitly.

-- ─── #10: Fix concept_tests panelist read policy ──────────────────────────────
-- The old policy allowed ALL authenticated users to read ANY active concept
-- test via `status = 'active'`, leaking confidential R&D data to every
-- panelist. Replace it so panelists can only see tests they are assigned to.
DROP POLICY IF EXISTS concept_tests_select_panelist ON public.concept_tests;

CREATE POLICY concept_tests_select_panelist ON public.concept_tests
  FOR SELECT TO authenticated
  USING (
    assigned_panelist_ids @> ARRAY[auth.uid()::text]
  );
