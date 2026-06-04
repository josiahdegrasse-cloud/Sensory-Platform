-- Food intelligence: food types, instrumental import batches, measurements, audit log
-- Run after 004_response_session_fields.sql

CREATE TABLE IF NOT EXISTS food_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  label text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  source text NOT NULL DEFAULT 'system' CHECK (source IN ('system', 'import', 'manual')),
  aliases text[] DEFAULT '{}',
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  food_type_id uuid REFERENCES food_types(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  row_count integer NOT NULL DEFAULT 0,
  recognized_columns text[] DEFAULT '{}',
  ignored_columns text[] DEFAULT '{}',
  detection_confidence numeric(5,4) DEFAULT 0,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted')),
  imported_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS instrumental_samples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_batch_id uuid REFERENCES import_batches(id) ON DELETE CASCADE,
  food_type_id uuid REFERENCES food_types(id) ON DELETE CASCADE,
  sample_id text NOT NULL,
  sample_name text,
  category text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS e_tongue_measurements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sample_id uuid REFERENCES instrumental_samples(id) ON DELETE CASCADE,
  sourness numeric NOT NULL DEFAULT 0,
  bitterness numeric NOT NULL DEFAULT 0,
  saltiness numeric NOT NULL DEFAULT 0,
  umami numeric NOT NULL DEFAULT 0,
  sweetness numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS gcms_compounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sample_id uuid REFERENCES instrumental_samples(id) ON DELETE CASCADE,
  name text NOT NULL,
  concentration numeric NOT NULL DEFAULT 0,
  aroma text NOT NULL DEFAULT 'unknown',
  threshold numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS composition_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sample_id uuid REFERENCES instrumental_samples(id) ON DELETE CASCADE,
  protein numeric NOT NULL DEFAULT 0,
  fat numeric NOT NULL DEFAULT 0,
  moisture numeric NOT NULL DEFAULT 0,
  ph numeric NOT NULL DEFAULT 0,
  salt_content numeric NOT NULL DEFAULT 0,
  calcium_mg numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  entity_type text,
  entity_id uuid,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Row Level Security
ALTER TABLE food_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE instrumental_samples ENABLE ROW LEVEL SECURITY;
ALTER TABLE e_tongue_measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE gcms_compounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE composition_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;

-- Admin-only policies
CREATE POLICY "admin_food_types" ON food_types FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "admin_import_batches" ON import_batches FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "admin_instrumental_samples" ON instrumental_samples FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "admin_e_tongue" ON e_tongue_measurements FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "admin_gcms" ON gcms_compounds FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "admin_composition" ON composition_profiles FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "admin_audit_events" ON audit_events FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Seed canonical system food types
INSERT INTO food_types (slug, label, status, source, aliases) VALUES
  ('cheese',   'Cheese',   'active', 'system', ARRAY['cheese','dairy','milk','cream','cheddar','mozzarella','gouda','parmesan','brie','pbca']),
  ('bread',    'Bread',    'active', 'system', ARRAY['bread','bakery','baked','loaf','pastry','sourdough','rye','brioche','baguette']),
  ('meat',     'Meat',     'active', 'system', ARRAY['meat','beef','pork','chicken','poultry','turkey','lamb','steak','burger','patty','mince','sausage']),
  ('yogurt',   'Yogurt',   'active', 'system', ARRAY['yogurt','yoghurt','skyr','kefir']),
  ('beverage', 'Beverage', 'active', 'system', ARRAY['drink','beverage','juice','soda','wine','beer','coffee','tea'])
ON CONFLICT (slug) DO NOTHING;
