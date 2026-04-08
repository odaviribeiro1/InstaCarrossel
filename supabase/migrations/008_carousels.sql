-- 008_carousels.sql
-- Carrosseis, slides e versionamento

CREATE TABLE IF NOT EXISTS carousels (
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

-- Trigger para atualizar updated_at
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

CREATE TRIGGER trg_carousels_updated_at
  BEFORE UPDATE ON carousels
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE carousels ENABLE ROW LEVEL SECURITY;
ALTER TABLE carousel_slides ENABLE ROW LEVEL SECURITY;
ALTER TABLE carousel_versions ENABLE ROW LEVEL SECURITY;

-- Carousels
CREATE POLICY "carousels_select" ON carousels
  FOR SELECT USING (is_workspace_member(workspace_id));

CREATE POLICY "carousels_insert" ON carousels
  FOR INSERT WITH CHECK (
    get_user_role(workspace_id) IN ('owner', 'admin', 'editor')
  );

CREATE POLICY "carousels_update" ON carousels
  FOR UPDATE USING (
    get_user_role(workspace_id) IN ('owner', 'admin', 'editor')
  );

CREATE POLICY "carousels_delete" ON carousels
  FOR DELETE USING (
    get_user_role(workspace_id) IN ('owner', 'admin')
  );

-- Carousel Slides (workspace_id desnormalizado)
CREATE POLICY "slides_select" ON carousel_slides
  FOR SELECT USING (is_workspace_member(workspace_id));

CREATE POLICY "slides_insert" ON carousel_slides
  FOR INSERT WITH CHECK (
    get_user_role(workspace_id) IN ('owner', 'admin', 'editor')
  );

CREATE POLICY "slides_update" ON carousel_slides
  FOR UPDATE USING (
    get_user_role(workspace_id) IN ('owner', 'admin', 'editor')
  );

CREATE POLICY "slides_delete" ON carousel_slides
  FOR DELETE USING (
    get_user_role(workspace_id) IN ('owner', 'admin')
  );

-- Carousel Versions
CREATE POLICY "versions_select" ON carousel_versions
  FOR SELECT USING (
    carousel_id IN (
      SELECT id FROM carousels WHERE is_workspace_member(workspace_id)
    )
  );

CREATE POLICY "versions_insert" ON carousel_versions
  FOR INSERT WITH CHECK (
    carousel_id IN (
      SELECT id FROM carousels
      WHERE get_user_role(workspace_id) IN ('owner', 'admin', 'editor')
    )
  );
