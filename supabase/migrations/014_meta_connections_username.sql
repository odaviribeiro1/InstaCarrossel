-- 014_meta_connections_username.sql
-- Add ig_username and fb_user_name columns for display purposes

ALTER TABLE meta_connections ADD COLUMN IF NOT EXISTS ig_username text;
ALTER TABLE meta_connections ADD COLUMN IF NOT EXISTS fb_user_name text;
