-- 005_brand_kits.sql
-- Brand Kits por workspace

CREATE TABLE IF NOT EXISTS brand_kits (
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

-- Trigger: garantir apenas um brand kit default por workspace
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

CREATE TRIGGER trg_single_default_brand_kit
  BEFORE INSERT OR UPDATE ON brand_kits
  FOR EACH ROW
  EXECUTE FUNCTION ensure_single_default_brand_kit();

-- RLS
ALTER TABLE brand_kits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "brand_kits_select" ON brand_kits
  FOR SELECT USING (is_workspace_member(workspace_id));

CREATE POLICY "brand_kits_insert" ON brand_kits
  FOR INSERT WITH CHECK (
    get_user_role(workspace_id) IN ('owner', 'admin', 'editor')
  );

CREATE POLICY "brand_kits_update" ON brand_kits
  FOR UPDATE USING (
    get_user_role(workspace_id) IN ('owner', 'admin', 'editor')
  );

CREATE POLICY "brand_kits_delete" ON brand_kits
  FOR DELETE USING (
    get_user_role(workspace_id) IN ('owner', 'admin')
  );
