-- 001_extensions.sql
-- Habilitar extensoes necessarias para o Content Hub

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pgsodium";
CREATE EXTENSION IF NOT EXISTS "supabase_vault";
