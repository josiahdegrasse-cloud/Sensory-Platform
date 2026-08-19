-- Give active workspace administrators the minimum panelist safety detail
-- needed for study planning. Access is through an audited RPC rather than a
-- broad table SELECT policy, so every declaration view is attributable.

CREATE FUNCTION public.get_panelist_safety_declaration(target_panelist_id uuid)
RETURNS TABLE (
  panelist_id uuid,
  allergen_avoidances text[],
  other_avoidances text[],
  declaration_confirmed_at timestamptz,
  declaration_expires_at timestamptz,
  health_consent_at timestamptz,
  health_consent_version text,
  adult_confirmed_at timestamptz,
  age_band text,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_org uuid := public.current_org_id();
  v_record public.panelist_eligibility_profiles%ROWTYPE;
  v_age integer;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only active administrators can view panelist safety declarations';
  END IF;

  SELECT e.* INTO v_record
  FROM public.panelist_eligibility_profiles e
  JOIN public.profiles p ON p.id = e.panelist_id AND p.org_id = e.org_id
  WHERE e.panelist_id = target_panelist_id
    AND e.org_id = v_org
    AND p.role = 'panelist';

  IF NOT FOUND THEN
    RETURN;
  END IF;

  INSERT INTO public.audit_events (
    actor_id, event_type, entity_type, entity_id, org_id, metadata
  ) VALUES (
    auth.uid(),
    'panelist_safety_declaration_viewed',
    'profiles',
    target_panelist_id,
    v_org,
    jsonb_build_object(
      'declaration_confirmed_at', v_record.declaration_confirmed_at,
      'declaration_expires_at', v_record.declaration_expires_at
    )
  );

  v_age := extract(year FROM age(
    current_date,
    make_date(v_record.birth_year, v_record.birth_month, 1)
  ))::integer;

  panelist_id := v_record.panelist_id;
  allergen_avoidances := v_record.allergen_avoidances;
  other_avoidances := v_record.other_avoidances;
  declaration_confirmed_at := v_record.declaration_confirmed_at;
  declaration_expires_at := v_record.declaration_expires_at;
  health_consent_at := v_record.health_consent_at;
  health_consent_version := v_record.health_consent_version;
  adult_confirmed_at := v_record.adult_confirmed_at;
  age_band := CASE
    WHEN v_age < 25 THEN '18–24'
    WHEN v_age < 35 THEN '25–34'
    WHEN v_age < 45 THEN '35–44'
    WHEN v_age < 55 THEN '45–54'
    WHEN v_age < 65 THEN '55–64'
    ELSE '65+'
  END;
  updated_at := v_record.updated_at;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.get_panelist_safety_declaration(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_panelist_safety_declaration(uuid) TO authenticated;

