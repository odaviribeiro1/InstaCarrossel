-- 009_custom_fonts.sql
-- Fontes customizadas por workspace

CREATE TABLE IF NOT EXISTS custom_fonts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  family_name text NOT NULL,
  font_url text NOT NULL,
  format text NOT NULL CHECK (format IN ('woff2', 'ttf', 'otf')),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_custom_fonts_workspace_id ON custom_fonts(workspace_id);

-- RLS
ALTER TABLE custom_fonts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fonts_select" ON custom_fonts
  FOR SELECT USING (is_workspace_member(workspace_id));

CREATE POLICY "fonts_insert" ON custom_fonts
  FOR INSERT WITH CHECK (
    get_user_role(workspace_id) IN ('owner', 'admin', 'editor')
  );

CREATE POLICY "fonts_delete" ON custom_fonts
  FOR DELETE USING (
    get_user_role(workspace_id) IN ('owner', 'admin')
  );
