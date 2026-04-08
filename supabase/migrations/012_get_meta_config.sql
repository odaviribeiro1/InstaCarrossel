-- 012_get_meta_config.sql
-- RPC function to return Meta credentials status (never exposes the secret itself)

CREATE OR REPLACE FUNCTION get_meta_config()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'meta_app_id', pc.meta_app_id,
    'has_app_secret', (pc.meta_app_secret_id IS NOT NULL)
  ) INTO result
  FROM platform_config pc
  LIMIT 1;

  IF result IS NULL THEN
    RETURN jsonb_build_object('meta_app_id', null, 'has_app_secret', false);
  END IF;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_meta_config() TO authenticated;
