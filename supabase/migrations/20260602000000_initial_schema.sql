CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text,
  role text NOT NULL DEFAULT 'panelist' CHECK (role IN ('admin', 'panelist')),
  panelist_id text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  custom_attributes text[] DEFAULT '{}',
  is_multi_sample boolean NOT NULL DEFAULT false,
  samples jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  run_number integer NOT NULL DEFAULT 1,
  cata_attributes text[] DEFAULT '{}',
  intensity_ratings jsonb DEFAULT '{}',
  hedonic_scores jsonb DEFAULT '{}',
  emotional_profile jsonb DEFAULT '{}',
  comments text,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, product_id, run_number)
);

CREATE TABLE IF NOT EXISTS public.templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  attributes text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.concept_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL DEFAULT '',
  description text DEFAULT '',
  image_urls text[] DEFAULT '{}',
  target_market text DEFAULT '',
  price_point text DEFAULT '',
  key_benefits text DEFAULT '',
  questions jsonb NOT NULL DEFAULT '[]',
  panel_size integer NOT NULL DEFAULT 50,
  assigned_panelist_ids text[] DEFAULT '{}',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.concept_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  concept_test_id uuid NOT NULL REFERENCES public.concept_tests(id) ON DELETE CASCADE,
  answers jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, concept_test_id)
);

CREATE INDEX IF NOT EXISTS idx_responses_user_product ON public.responses (user_id, product_id);
CREATE INDEX IF NOT EXISTS idx_responses_product ON public.responses (product_id);
CREATE INDEX IF NOT EXISTS idx_concept_responses_user ON public.concept_responses (user_id);
CREATE INDEX IF NOT EXISTS idx_concept_responses_test ON public.concept_responses (concept_test_id);

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, name, role)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'name', 'panelist')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
