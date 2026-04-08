-- 002_platform_config.sql
-- Tabela singleton para configuracao da plataforma

CREATE TABLE IF NOT EXISTS platform_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supabase_url text NOT NULL,
  supabase_anon_key text NOT NULL,
  meta_app_id text,
  meta_app_secret_id uuid,
  setup_completed boolean DEFAULT false,
  setup_step int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- RLS: platform_config inacessivel via anon key
ALTER TABLE platform_config ENABLE ROW LEVEL SECURITY;

-- Funcao RPC publica para verificar status do setup (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION get_setup_status()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'setup_completed', COALESCE(pc.setup_completed, false),
    'setup_step', COALESCE(pc.setup_step, 0)
  ) INTO result
  FROM platform_config pc
  LIMIT 1;

  IF result IS NULL THEN
    RETURN jsonb_build_object('setup_completed', false, 'setup_step', 0);
  END IF;

  RETURN result;
END;
$$;

-- Permitir execucao da funcao por qualquer usuario autenticado
GRANT EXECUTE ON FUNCTION get_setup_status() TO authenticated;
GRANT EXECUTE ON FUNCTION get_setup_status() TO anon;
