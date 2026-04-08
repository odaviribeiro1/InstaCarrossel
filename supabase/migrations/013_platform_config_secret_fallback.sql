-- 013_platform_config_secret_fallback.sql
-- Add direct meta_app_secret column as fallback when Vault is not available

ALTER TABLE platform_config ADD COLUMN IF NOT EXISTS meta_app_secret text;
