-- Core tables for the Sensory Analysis Dashboard
-- Run in Supabase SQL editor before first deployment

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'panelist' CHECK (role IN ('admin', 'panelist')),
  panelist_id text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
  custom_attributes text[],
  is_multi_sample boolean NOT NULL DEFAULT false,
  samples jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE CASCADE,
  run_number integer NOT NULL DEFAULT 1,
  cata_attributes text[] DEFAULT '{}',
  intensity_ratings jsonb DEFAULT '{}',
  hedonic_scores jsonb DEFAULT '{}',
  emotional_profile jsonb DEFAULT '{}',
  comments text,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT responses_user_product_run UNIQUE (user_id, product_id, run_number)
);

CREATE TABLE IF NOT EXISTS templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  attributes text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);
