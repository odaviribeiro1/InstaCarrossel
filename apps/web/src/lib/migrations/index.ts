/**
 * SQL Migrations bundled as static strings.
 * These are sent to the Edge Function `bootstrap` for execution.
 * NEVER interpolate user input into these strings.
 */

export interface Migration {
  version: string;
  description: string;
  sql: string;
}

export const migrations: Migration[] = [
  {
    version: '001_extensions',
    description: 'Habilitar extensoes necessarias',
    sql: `CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pgsodium";
CREATE EXTENSION IF NOT EXISTS "supabase_vault";

-- exec_sql: permite bootstrap executar migrations via RPC
CREATE OR REPLACE FUNCTION exec_sql(query text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  EXECUTE query;
END;
$$;

-- Restringir exec_sql apenas a service role
REVOKE EXECUTE ON FUNCTION exec_sql(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION exec_sql(text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION exec_sql(text) FROM anon;
GRANT EXECUTE ON FUNCTION exec_sql(text) TO service_role;

-- vault_insert: armazena secret no Vault e retorna UUID
CREATE OR REPLACE FUNCTION vault_insert(new_secret text, new_name text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id uuid;
BEGIN
  INSERT INTO vault.secrets (secret, name)
  VALUES (new_secret, new_name)
  RETURNING id INTO new_id;
  RETURN new_id;
END;
$$;

-- vault_read: le secret decriptado por UUID
CREATE OR REPLACE FUNCTION vault_read(secret_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  decrypted text;
BEGIN
  SELECT decrypted_secret INTO decrypted
  FROM vault.decrypted_secrets
  WHERE id = secret_id;
  RETURN decrypted;
END;
$$;

-- Restringir vault functions
REVOKE EXECUTE ON FUNCTION vault_insert(text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION vault_insert(text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION vault_insert(text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION vault_insert(text, text) TO service_role;
REVOKE EXECUTE ON FUNCTION vault_read(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION vault_read(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION vault_read(uuid) TO service_role;`,
  },
  {
    version: '002_platform_config',
    description: 'Tabela platform_config e funcao get_setup_status',
    sql: `CREATE TABLE IF NOT EXISTS platform_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supabase_url text NOT NULL,
  supabase_anon_key text NOT NULL,
  meta_app_id text,
  meta_app_secret_id uuid,
  setup_completed boolean DEFAULT false,
  setup_step int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE platform_config ENABLE ROW LEVEL SECURITY;

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

GRANT EXECUTE ON FUNCTION get_setup_status() TO authenticated;
GRANT EXECUTE ON FUNCTION get_setup_status() TO anon;`,
  },
  {
    version: '003_schema_versions',
    description: 'Controle de migrations executadas',
    sql: `CREATE TABLE IF NOT EXISTS schema_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version text NOT NULL UNIQUE,
  description text,
  executed_at timestamptz DEFAULT now(),
  success boolean DEFAULT true,
  error_message text
);

ALTER TABLE schema_versions ENABLE ROW LEVEL SECURITY;`,
  },
  {
    version: '004_workspaces',
    description: 'Workspaces, membros e funcoes auxiliares',
    sql: `CREATE TABLE IF NOT EXISTS workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  custom_domain text,
  logo_url text,
  favicon_url text,
  brand_primary_color text DEFAULT '#6366f1',
  brand_secondary_color text DEFAULT '#8b5cf6',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workspace_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner', 'admin', 'editor', 'viewer')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_workspace_members_user_id ON workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace_id ON workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspaces_custom_domain ON workspaces(custom_domain);
CREATE INDEX IF NOT EXISTS idx_workspaces_slug ON workspaces(slug);

CREATE OR REPLACE FUNCTION get_user_role(p_workspace_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  SELECT role INTO v_role
  FROM workspace_members
  WHERE workspace_id = p_workspace_id
    AND user_id = auth.uid();
  RETURN v_role;
END;
$$;

CREATE OR REPLACE FUNCTION is_workspace_member(p_workspace_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = p_workspace_id
      AND user_id = auth.uid()
  );
END;
$$;

CREATE OR REPLACE FUNCTION workspace_has_no_members(p_workspace_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  RETURN NOT EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = p_workspace_id
  );
END;
$$;

ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workspace_select" ON workspaces;
CREATE POLICY "workspace_select" ON workspaces
  FOR SELECT USING (is_workspace_member(id));

DROP POLICY IF EXISTS "workspace_insert" ON workspaces;
CREATE POLICY "workspace_insert" ON workspaces
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "workspace_update" ON workspaces;
CREATE POLICY "workspace_update" ON workspaces
  FOR UPDATE USING (
    get_user_role(id) IN ('owner', 'admin')
  );

DROP POLICY IF EXISTS "workspace_delete" ON workspaces;
CREATE POLICY "workspace_delete" ON workspaces
  FOR DELETE USING (
    get_user_role(id) = 'owner'
  );

DROP POLICY IF EXISTS "members_select" ON workspace_members;
CREATE POLICY "members_select" ON workspace_members
  FOR SELECT USING (is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "members_insert" ON workspace_members;
CREATE POLICY "members_insert" ON workspace_members
  FOR INSERT WITH CHECK (
    get_user_role(workspace_id) IN ('owner', 'admin')
    OR workspace_has_no_members(workspace_id)
  );

DROP POLICY IF EXISTS "members_update" ON workspace_members;
CREATE POLICY "members_update" ON workspace_members
  FOR UPDATE USING (
    get_user_role(workspace_id) IN ('owner', 'admin')
  );

DROP POLICY IF EXISTS "members_delete" ON workspace_members;
CREATE POLICY "members_delete" ON workspace_members
  FOR DELETE USING (
    get_user_role(workspace_id) IN ('owner', 'admin')
  );

GRANT EXECUTE ON FUNCTION get_user_role(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION is_workspace_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION workspace_has_no_members(uuid) TO authenticated;`,
  },
  {
    version: '005_brand_kits',
    description: 'Brand Kits por workspace',
    sql: `CREATE TABLE IF NOT EXISTS brand_kits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  colors jsonb NOT NULL DEFAULT '{"primary":"#6366f1","secondary":"#8b5cf6","accent":"#f59e0b","background":"#ffffff","text":"#1f2937"}',
  fonts jsonb NOT NULL DEFAULT '{"heading":{"family":"Inter","url":""},"body":{"family":"Inter","url":""}}',
  logo_url text,
  avatar_url text,
  tone_of_voice text,
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brand_kits_workspace_id ON brand_kits(workspace_id);

CREATE OR REPLACE FUNCTION ensure_single_default_brand_kit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE brand_kits
    SET is_default = false
    WHERE workspace_id = NEW.workspace_id
      AND id != NEW.id
      AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_single_default_brand_kit ON brand_kits;
CREATE TRIGGER trg_single_default_brand_kit
  BEFORE INSERT OR UPDATE ON brand_kits
  FOR EACH ROW
  EXECUTE FUNCTION ensure_single_default_brand_kit();

ALTER TABLE brand_kits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "brand_kits_select" ON brand_kits;
CREATE POLICY "brand_kits_select" ON brand_kits
  FOR SELECT USING (is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "brand_kits_insert" ON brand_kits;
CREATE POLICY "brand_kits_insert" ON brand_kits
  FOR INSERT WITH CHECK (
    get_user_role(workspace_id) IN ('owner', 'admin', 'editor')
  );

DROP POLICY IF EXISTS "brand_kits_update" ON brand_kits;
CREATE POLICY "brand_kits_update" ON brand_kits
  FOR UPDATE USING (
    get_user_role(workspace_id) IN ('owner', 'admin', 'editor')
  );

DROP POLICY IF EXISTS "brand_kits_delete" ON brand_kits;
CREATE POLICY "brand_kits_delete" ON brand_kits
  FOR DELETE USING (
    get_user_role(workspace_id) IN ('owner', 'admin')
  );`,
  },
  {
    version: '006_ai_configs',
    description: 'Configuracao de IA por workspace',
    sql: `CREATE TABLE IF NOT EXISTS ai_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  llm_provider text NOT NULL DEFAULT 'openai',
  llm_model text NOT NULL DEFAULT 'gpt-4o',
  llm_api_key_id uuid,
  imagen_api_key_id uuid,
  supadata_api_key_id uuid,
  created_at timestamptz DEFAULT now(),
  UNIQUE(workspace_id)
);

CREATE INDEX IF NOT EXISTS idx_ai_configs_workspace_id ON ai_configs(workspace_id);

ALTER TABLE ai_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_configs_select" ON ai_configs;
CREATE POLICY "ai_configs_select" ON ai_configs
  FOR SELECT USING (is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "ai_configs_insert" ON ai_configs;
CREATE POLICY "ai_configs_insert" ON ai_configs
  FOR INSERT WITH CHECK (
    get_user_role(workspace_id) IN ('owner', 'admin')
  );

DROP POLICY IF EXISTS "ai_configs_update" ON ai_configs;
CREATE POLICY "ai_configs_update" ON ai_configs
  FOR UPDATE USING (
    get_user_role(workspace_id) IN ('owner', 'admin')
  );

DROP POLICY IF EXISTS "ai_configs_delete" ON ai_configs;
CREATE POLICY "ai_configs_delete" ON ai_configs
  FOR DELETE USING (
    get_user_role(workspace_id) = 'owner'
  );`,
  },
  {
    version: '007_templates',
    description: 'Templates e variacoes por posicao de slide',
    sql: `CREATE TABLE IF NOT EXISTS templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text NOT NULL CHECK (category IN ('educacional', 'vendas', 'storytelling', 'antes_depois', 'lista', 'cta')),
  is_system boolean DEFAULT false,
  thumbnail_url text,
  slide_count_default int DEFAULT 5,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS template_slide_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  slide_position text NOT NULL CHECK (slide_position IN ('capa', 'conteudo', 'cta', 'transicao')),
  variant_name text NOT NULL,
  layout_json jsonb NOT NULL DEFAULT '{}',
  thumbnail_url text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_templates_workspace_id ON templates(workspace_id);
CREATE INDEX IF NOT EXISTS idx_templates_category ON templates(category);
CREATE INDEX IF NOT EXISTS idx_template_slide_variants_template_id ON template_slide_variants(template_id);

ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_slide_variants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "templates_select" ON templates;
CREATE POLICY "templates_select" ON templates
  FOR SELECT USING (
    workspace_id IS NULL
    OR is_workspace_member(workspace_id)
  );

DROP POLICY IF EXISTS "templates_insert" ON templates;
CREATE POLICY "templates_insert" ON templates
  FOR INSERT WITH CHECK (
    workspace_id IS NOT NULL
    AND get_user_role(workspace_id) IN ('owner', 'admin', 'editor')
  );

DROP POLICY IF EXISTS "templates_update" ON templates;
CREATE POLICY "templates_update" ON templates
  FOR UPDATE USING (
    workspace_id IS NOT NULL
    AND get_user_role(workspace_id) IN ('owner', 'admin', 'editor')
  );

DROP POLICY IF EXISTS "templates_delete" ON templates;
CREATE POLICY "templates_delete" ON templates
  FOR DELETE USING (
    workspace_id IS NOT NULL
    AND get_user_role(workspace_id) IN ('owner', 'admin')
  );

DROP POLICY IF EXISTS "variants_select" ON template_slide_variants;
CREATE POLICY "variants_select" ON template_slide_variants
  FOR SELECT USING (
    template_id IN (
      SELECT id FROM templates
      WHERE workspace_id IS NULL
        OR is_workspace_member(workspace_id)
    )
  );

DROP POLICY IF EXISTS "variants_insert" ON template_slide_variants;
CREATE POLICY "variants_insert" ON template_slide_variants
  FOR INSERT WITH CHECK (
    template_id IN (
      SELECT id FROM templates
      WHERE workspace_id IS NOT NULL
        AND get_user_role(workspace_id) IN ('owner', 'admin', 'editor')
    )
  );

DROP POLICY IF EXISTS "variants_update" ON template_slide_variants;
CREATE POLICY "variants_update" ON template_slide_variants
  FOR UPDATE USING (
    template_id IN (
      SELECT id FROM templates
      WHERE workspace_id IS NOT NULL
        AND get_user_role(workspace_id) IN ('owner', 'admin', 'editor')
    )
  );

DROP POLICY IF EXISTS "variants_delete" ON template_slide_variants;
CREATE POLICY "variants_delete" ON template_slide_variants
  FOR DELETE USING (
    template_id IN (
      SELECT id FROM templates
      WHERE workspace_id IS NOT NULL
        AND get_user_role(workspace_id) IN ('owner', 'admin')
    )
  );`,
  },
  {
    version: '008_carousels',
    description: 'Carrosseis, slides e versionamento',
    sql: `CREATE TABLE IF NOT EXISTS carousels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  title text NOT NULL DEFAULT 'Sem titulo',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'ready', 'scheduled', 'published')),
  brand_kit_id uuid REFERENCES brand_kits(id) ON DELETE SET NULL,
  template_id uuid REFERENCES templates(id) ON DELETE SET NULL,
  slide_count int DEFAULT 0,
  ai_input jsonb,
  scheduled_at timestamptz,
  published_at timestamptz,
  meta_post_id text,
  editing_by uuid REFERENCES auth.users(id),
  editing_at timestamptz,
  version int DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS carousel_slides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  carousel_id uuid NOT NULL REFERENCES carousels(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  position int NOT NULL DEFAULT 0,
  canvas_json jsonb NOT NULL DEFAULT '{}',
  thumbnail_url text,
  export_url text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS carousel_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  carousel_id uuid NOT NULL REFERENCES carousels(id) ON DELETE CASCADE,
  version int NOT NULL,
  snapshot_json jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  created_by uuid NOT NULL REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_carousels_workspace_id ON carousels(workspace_id);
CREATE INDEX IF NOT EXISTS idx_carousels_created_by ON carousels(created_by);
CREATE INDEX IF NOT EXISTS idx_carousels_status ON carousels(status);
CREATE INDEX IF NOT EXISTS idx_carousel_slides_carousel_id ON carousel_slides(carousel_id);
CREATE INDEX IF NOT EXISTS idx_carousel_slides_workspace_id ON carousel_slides(workspace_id);
CREATE INDEX IF NOT EXISTS idx_carousel_versions_carousel_id ON carousel_versions(carousel_id);

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_carousels_updated_at ON carousels;
CREATE TRIGGER trg_carousels_updated_at
  BEFORE UPDATE ON carousels
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

ALTER TABLE carousels ENABLE ROW LEVEL SECURITY;
ALTER TABLE carousel_slides ENABLE ROW LEVEL SECURITY;
ALTER TABLE carousel_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "carousels_select" ON carousels;
CREATE POLICY "carousels_select" ON carousels
  FOR SELECT USING (is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "carousels_insert" ON carousels;
CREATE POLICY "carousels_insert" ON carousels
  FOR INSERT WITH CHECK (
    get_user_role(workspace_id) IN ('owner', 'admin', 'editor')
  );

DROP POLICY IF EXISTS "carousels_update" ON carousels;
CREATE POLICY "carousels_update" ON carousels
  FOR UPDATE USING (
    get_user_role(workspace_id) IN ('owner', 'admin', 'editor')
  );

DROP POLICY IF EXISTS "carousels_delete" ON carousels;
CREATE POLICY "carousels_delete" ON carousels
  FOR DELETE USING (
    get_user_role(workspace_id) IN ('owner', 'admin')
  );

DROP POLICY IF EXISTS "slides_select" ON carousel_slides;
CREATE POLICY "slides_select" ON carousel_slides
  FOR SELECT USING (is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "slides_insert" ON carousel_slides;
CREATE POLICY "slides_insert" ON carousel_slides
  FOR INSERT WITH CHECK (
    get_user_role(workspace_id) IN ('owner', 'admin', 'editor')
  );

DROP POLICY IF EXISTS "slides_update" ON carousel_slides;
CREATE POLICY "slides_update" ON carousel_slides
  FOR UPDATE USING (
    get_user_role(workspace_id) IN ('owner', 'admin', 'editor')
  );

DROP POLICY IF EXISTS "slides_delete" ON carousel_slides;
CREATE POLICY "slides_delete" ON carousel_slides
  FOR DELETE USING (
    get_user_role(workspace_id) IN ('owner', 'admin')
  );

DROP POLICY IF EXISTS "versions_select" ON carousel_versions;
CREATE POLICY "versions_select" ON carousel_versions
  FOR SELECT USING (
    carousel_id IN (
      SELECT id FROM carousels WHERE is_workspace_member(workspace_id)
    )
  );

DROP POLICY IF EXISTS "versions_insert" ON carousel_versions;
CREATE POLICY "versions_insert" ON carousel_versions
  FOR INSERT WITH CHECK (
    carousel_id IN (
      SELECT id FROM carousels
      WHERE get_user_role(workspace_id) IN ('owner', 'admin', 'editor')
    )
  );`,
  },
  {
    version: '009_custom_fonts',
    description: 'Fontes customizadas por workspace',
    sql: `CREATE TABLE IF NOT EXISTS custom_fonts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  family_name text NOT NULL,
  font_url text NOT NULL,
  format text NOT NULL CHECK (format IN ('woff2', 'ttf', 'otf')),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_custom_fonts_workspace_id ON custom_fonts(workspace_id);

ALTER TABLE custom_fonts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fonts_select" ON custom_fonts;
CREATE POLICY "fonts_select" ON custom_fonts
  FOR SELECT USING (is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "fonts_insert" ON custom_fonts;
CREATE POLICY "fonts_insert" ON custom_fonts
  FOR INSERT WITH CHECK (
    get_user_role(workspace_id) IN ('owner', 'admin', 'editor')
  );

DROP POLICY IF EXISTS "fonts_delete" ON custom_fonts;
CREATE POLICY "fonts_delete" ON custom_fonts
  FOR DELETE USING (
    get_user_role(workspace_id) IN ('owner', 'admin')
  );`,
  },
  {
    version: '010_meta_connections',
    description: 'Meta OAuth connections e scheduled posts',
    sql: `CREATE TABLE IF NOT EXISTS meta_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token_id uuid,
  ig_user_id text,
  fb_page_id text,
  token_expires_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(workspace_id, user_id)
);

CREATE TABLE IF NOT EXISTS scheduled_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  carousel_id uuid NOT NULL REFERENCES carousels(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  scheduled_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'publishing', 'published', 'failed')),
  error_message text,
  meta_post_id text,
  published_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meta_connections_workspace_id ON meta_connections(workspace_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_workspace_id ON scheduled_posts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_status ON scheduled_posts(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_scheduled_at ON scheduled_posts(scheduled_at);

ALTER TABLE meta_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "meta_select" ON meta_connections;
CREATE POLICY "meta_select" ON meta_connections
  FOR SELECT USING (is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "meta_insert" ON meta_connections;
CREATE POLICY "meta_insert" ON meta_connections
  FOR INSERT WITH CHECK (
    get_user_role(workspace_id) IN ('owner', 'admin')
  );

DROP POLICY IF EXISTS "meta_update" ON meta_connections;
CREATE POLICY "meta_update" ON meta_connections
  FOR UPDATE USING (
    get_user_role(workspace_id) IN ('owner', 'admin')
  );

DROP POLICY IF EXISTS "meta_delete" ON meta_connections;
CREATE POLICY "meta_delete" ON meta_connections
  FOR DELETE USING (
    get_user_role(workspace_id) IN ('owner', 'admin')
  );

DROP POLICY IF EXISTS "scheduled_select" ON scheduled_posts;
CREATE POLICY "scheduled_select" ON scheduled_posts
  FOR SELECT USING (is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "scheduled_insert" ON scheduled_posts;
CREATE POLICY "scheduled_insert" ON scheduled_posts
  FOR INSERT WITH CHECK (
    get_user_role(workspace_id) IN ('owner', 'admin', 'editor')
  );

DROP POLICY IF EXISTS "scheduled_update" ON scheduled_posts;
CREATE POLICY "scheduled_update" ON scheduled_posts
  FOR UPDATE USING (
    get_user_role(workspace_id) IN ('owner', 'admin', 'editor')
  );

DROP POLICY IF EXISTS "scheduled_delete" ON scheduled_posts;
CREATE POLICY "scheduled_delete" ON scheduled_posts
  FOR DELETE USING (
    get_user_role(workspace_id) IN ('owner', 'admin')
  );`,
  },
  {
    version: '011_storage_buckets',
    description: 'Storage buckets para assets',
    sql: `INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('logos', 'logos', true, 5242880, ARRAY['image/png', 'image/jpeg', 'image/svg+xml', 'image/x-icon', 'image/vnd.microsoft.icon']),
  ('avatars', 'avatars', true, 5242880, ARRAY['image/png', 'image/jpeg']),
  ('fonts', 'fonts', false, 2097152, ARRAY['font/woff2', 'font/ttf', 'font/otf', 'application/font-woff2', 'application/x-font-ttf', 'application/vnd.ms-opentype']),
  ('exports', 'exports', false, 10485760, ARRAY['image/png']),
  ('images', 'images', false, 10485760, ARRAY['image/png', 'image/jpeg', 'image/gif', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  CREATE POLICY "storage_logos_select" ON storage.objects
    FOR SELECT USING (bucket_id = 'logos' AND auth.role() = 'authenticated');
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "storage_logos_insert" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'logos' AND auth.role() = 'authenticated');
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "storage_avatars_select" ON storage.objects
    FOR SELECT USING (bucket_id = 'avatars' AND auth.role() = 'authenticated');
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "storage_avatars_insert" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "storage_fonts_select" ON storage.objects
    FOR SELECT USING (bucket_id = 'fonts' AND auth.role() = 'authenticated');
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "storage_fonts_insert" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'fonts' AND auth.role() = 'authenticated');
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "storage_exports_select" ON storage.objects
    FOR SELECT USING (bucket_id = 'exports' AND auth.role() = 'authenticated');
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "storage_exports_insert" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'exports' AND auth.role() = 'authenticated');
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "storage_images_select" ON storage.objects
    FOR SELECT USING (bucket_id = 'images' AND auth.role() = 'authenticated');
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "storage_images_insert" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'images' AND auth.role() = 'authenticated');
EXCEPTION WHEN others THEN NULL;
END $$;`,
  },
  {
    version: '012_fix_rls_policies',
    description: 'Corrigir RLS policies para evitar recursao infinita',
    sql: `-- Helper function para verificar workspace sem membros
CREATE OR REPLACE FUNCTION workspace_has_no_members(p_workspace_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  RETURN NOT EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = p_workspace_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION workspace_has_no_members(uuid) TO authenticated;

-- Fix workspace_select: usar SECURITY DEFINER function em vez de subquery
DROP POLICY IF EXISTS "workspace_select" ON workspaces;
CREATE POLICY "workspace_select" ON workspaces
  FOR SELECT USING (is_workspace_member(id));

-- Fix members_select: usar SECURITY DEFINER function em vez de subquery auto-referencial
DROP POLICY IF EXISTS "members_select" ON workspace_members;
CREATE POLICY "members_select" ON workspace_members
  FOR SELECT USING (is_workspace_member(workspace_id));

-- Fix members_insert: usar SECURITY DEFINER function em vez de NOT EXISTS subquery
DROP POLICY IF EXISTS "members_insert" ON workspace_members;
CREATE POLICY "members_insert" ON workspace_members
  FOR INSERT WITH CHECK (
    get_user_role(workspace_id) IN ('owner', 'admin')
    OR workspace_has_no_members(workspace_id)
  );

-- Funcao para criar workspace + owner atomicamente (bypassa RLS chicken-and-egg)
CREATE OR REPLACE FUNCTION create_workspace_with_owner(
  p_name text,
  p_slug text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_workspace_id uuid;
BEGIN
  INSERT INTO workspaces (name, slug)
  VALUES (p_name, p_slug)
  RETURNING id INTO v_workspace_id;

  INSERT INTO workspace_members (workspace_id, user_id, role)
  VALUES (v_workspace_id, auth.uid(), 'owner');

  RETURN v_workspace_id;
END;
$$;

GRANT EXECUTE ON FUNCTION create_workspace_with_owner(text, text) TO authenticated;`,
  },
];
