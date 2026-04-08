-- 016_ai_configs_direct_keys.sql
-- Add direct API key columns as fallback when Vault is not available

ALTER TABLE ai_configs ADD COLUMN IF NOT EXISTS llm_api_key text;
ALTER TABLE ai_configs ADD COLUMN IF NOT EXISTS imagen_api_key text;
ALTER TABLE ai_configs ADD COLUMN IF NOT EXISTS supadata_api_key text;
