-- 007_templates.sql
-- Templates e variacoes por posicao de slide

CREATE TABLE IF NOT EXISTS templates (
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

-- RLS
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_slide_variants ENABLE ROW LEVEL SECURITY;

-- Templates do sistema (workspace_id IS NULL) acessiveis por qualquer usuario autenticado
CREATE POLICY "templates_select" ON templates
  FOR SELECT USING (
    workspace_id IS NULL
    OR is_workspace_member(workspace_id)
  );

CREATE POLICY "templates_insert" ON templates
  FOR INSERT WITH CHECK (
    workspace_id IS NOT NULL
    AND get_user_role(workspace_id) IN ('owner', 'admin', 'editor')
  );

CREATE POLICY "templates_update" ON templates
  FOR UPDATE USING (
    workspace_id IS NOT NULL
    AND get_user_role(workspace_id) IN ('owner', 'admin', 'editor')
  );

CREATE POLICY "templates_delete" ON templates
  FOR DELETE USING (
    workspace_id IS NOT NULL
    AND get_user_role(workspace_id) IN ('owner', 'admin')
  );

-- Template slide variants herdam acesso do template pai
CREATE POLICY "variants_select" ON template_slide_variants
  FOR SELECT USING (
    template_id IN (
      SELECT id FROM templates
      WHERE workspace_id IS NULL
        OR is_workspace_member(workspace_id)
    )
  );

CREATE POLICY "variants_insert" ON template_slide_variants
  FOR INSERT WITH CHECK (
    template_id IN (
      SELECT id FROM templates
      WHERE workspace_id IS NOT NULL
        AND get_user_role(workspace_id) IN ('owner', 'admin', 'editor')
    )
  );

CREATE POLICY "variants_update" ON template_slide_variants
  FOR UPDATE USING (
    template_id IN (
      SELECT id FROM templates
      WHERE workspace_id IS NOT NULL
        AND get_user_role(workspace_id) IN ('owner', 'admin', 'editor')
    )
  );

CREATE POLICY "variants_delete" ON template_slide_variants
  FOR DELETE USING (
    template_id IN (
      SELECT id FROM templates
      WHERE workspace_id IS NOT NULL
        AND get_user_role(workspace_id) IN ('owner', 'admin')
    )
  );
