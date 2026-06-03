-- Concept testing tables for consumer survey functionality
-- Run after 001_initial_schema.sql

CREATE TABLE IF NOT EXISTS concept_tests (
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

CREATE TABLE IF NOT EXISTS concept_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  concept_test_id uuid REFERENCES concept_tests(id) ON DELETE CASCADE,
  answers jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, concept_test_id)
);
