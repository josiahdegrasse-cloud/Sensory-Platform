-- Keep fresh databases aligned with the live products schema. The initial
-- migration created custom_attributes as text[], while later import functions,
-- launch validation, and the generated database types all require jsonb.
--
-- The linked production schema is already jsonb, so this migration is a no-op
-- there. Fail closed if an unexpected type is encountered rather than applying
-- an unsafe implicit conversion.
DO $$
DECLARE
  current_column_type text;
BEGIN
  SELECT format_type(attribute.atttypid, attribute.atttypmod)
  INTO current_column_type
  FROM pg_attribute AS attribute
  JOIN pg_class AS relation
    ON relation.oid = attribute.attrelid
  JOIN pg_namespace AS namespace
    ON namespace.oid = relation.relnamespace
  WHERE namespace.nspname = 'public'
    AND relation.relname = 'products'
    AND attribute.attname = 'custom_attributes'
    AND attribute.attnum > 0
    AND NOT attribute.attisdropped;

  IF current_column_type IS NULL THEN
    RAISE EXCEPTION 'public.products.custom_attributes does not exist';
  ELSIF current_column_type = 'jsonb' THEN
    RAISE NOTICE 'public.products.custom_attributes is already jsonb';
  ELSIF current_column_type = 'text[]' THEN
    ALTER TABLE public.products
      ALTER COLUMN custom_attributes DROP DEFAULT,
      ALTER COLUMN custom_attributes TYPE jsonb
        USING CASE
          WHEN custom_attributes IS NULL THEN NULL
          ELSE to_jsonb(custom_attributes)
        END,
      ALTER COLUMN custom_attributes SET DEFAULT '[]'::jsonb;
  ELSE
    RAISE EXCEPTION
      'Unexpected type for public.products.custom_attributes: %',
      current_column_type;
  END IF;
END;
$$;
