-- Panelists may submit additional single-sample runs only during the fixed
-- 30-minute window that begins with their first response to a study. Enforce
-- this in Postgres as well as the UI so a stale page or direct API request
-- cannot bypass the lock. Service-role imports remain unaffected.

CREATE OR REPLACE FUNCTION private.enforce_panelist_response_repeat_window()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_first_submitted_at timestamptz;
BEGIN
  IF auth.uid() IS NULL
     OR auth.uid() <> NEW.user_id
     OR NOT EXISTS (
       SELECT 1
       FROM public.profiles AS profile
       WHERE profile.id = auth.uid()
         AND profile.role = 'panelist'
     ) THEN
    RETURN NEW;
  END IF;

  -- Panelist response windows use the database clock. A direct API caller
  -- cannot extend the window by supplying a future created_at value.
  NEW.created_at := clock_timestamp();

  SELECT min(response.created_at)
  INTO v_first_submitted_at
  FROM public.responses AS response
  WHERE response.user_id = NEW.user_id
    AND response.product_id = NEW.product_id;

  IF v_first_submitted_at IS NOT NULL
     AND clock_timestamp() >= v_first_submitted_at + interval '30 minutes' THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'This survey is locked. Additional runs are available only for 30 minutes after the first submission.';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.enforce_panelist_response_repeat_window() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_enforce_panelist_response_repeat_window ON public.responses;
CREATE TRIGGER trg_enforce_panelist_response_repeat_window
  BEFORE INSERT ON public.responses
  FOR EACH ROW
  EXECUTE FUNCTION private.enforce_panelist_response_repeat_window();
