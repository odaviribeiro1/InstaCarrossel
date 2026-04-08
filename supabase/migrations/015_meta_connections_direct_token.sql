-- 015_meta_connections_direct_token.sql
-- Add direct access_token column as fallback when Vault is not available

ALTER TABLE meta_connections ADD COLUMN IF NOT EXISTS access_token text;
