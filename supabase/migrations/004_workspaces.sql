-- 004_workspaces.sql
-- Tabelas de workspace e membros

CREATE TABLE IF NOT EXISTS workspaces (
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

-- Funcao auxiliar para obter o role do usuario no workspace
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

-- Funcao para verificar se usuario pertence ao workspace
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

-- RLS
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;

-- Workspaces: usuario so ve workspaces onde e membro
CREATE POLICY "workspace_select" ON workspaces
  FOR SELECT USING (
    id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
  );

CREATE POLICY "workspace_insert" ON workspaces
  FOR INSERT WITH CHECK (true);

CREATE POLICY "workspace_update" ON workspaces
  FOR UPDATE USING (
    get_user_role(id) IN ('owner', 'admin')
  );

CREATE POLICY "workspace_delete" ON workspaces
  FOR DELETE USING (
    get_user_role(id) = 'owner'
  );

-- Workspace Members: membro so ve membros do seu workspace
CREATE POLICY "members_select" ON workspace_members
  FOR SELECT USING (
    workspace_id IN (SELECT workspace_id FROM workspace_members wm WHERE wm.user_id = auth.uid())
  );

CREATE POLICY "members_insert" ON workspace_members
  FOR INSERT WITH CHECK (
    get_user_role(workspace_id) IN ('owner', 'admin')
    OR NOT EXISTS (SELECT 1 FROM workspace_members WHERE workspace_id = workspace_members.workspace_id)
  );

CREATE POLICY "members_update" ON workspace_members
  FOR UPDATE USING (
    get_user_role(workspace_id) IN ('owner', 'admin')
  );

CREATE POLICY "members_delete" ON workspace_members
  FOR DELETE USING (
    get_user_role(workspace_id) IN ('owner', 'admin')
  );

GRANT EXECUTE ON FUNCTION get_user_role(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION is_workspace_member(uuid) TO authenticated;
