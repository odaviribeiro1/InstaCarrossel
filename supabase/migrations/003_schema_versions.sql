-- 003_schema_versions.sql
-- Controle de migrations executadas

CREATE TABLE IF NOT EXISTS schema_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version text NOT NULL UNIQUE,
  description text,
  executed_at timestamptz DEFAULT now(),
  success boolean DEFAULT true,
  error_message text
);

-- RLS: schema_versions inacessivel via anon key
ALTER TABLE schema_versions ENABLE ROW LEVEL SECURITY;
