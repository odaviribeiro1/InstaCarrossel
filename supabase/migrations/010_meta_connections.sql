-- 010_meta_connections.sql
-- Meta OAuth connections e scheduled posts

CREATE TABLE IF NOT EXISTS meta_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token_id uuid,
  ig_user_id text,
  fb_page_id text,
  token_expires_at timestamptz,
  created_at timestamptz DEFAULT now()
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

-- RLS
ALTER TABLE meta_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "meta_select" ON meta_connections
  FOR SELECT USING (is_workspace_member(workspace_id));

CREATE POLICY "meta_insert" ON meta_connections
  FOR INSERT WITH CHECK (
    get_user_role(workspace_id) IN ('owner', 'admin')
  );

CREATE POLICY "meta_update" ON meta_connections
  FOR UPDATE USING (
    get_user_role(workspace_id) IN ('owner', 'admin')
  );

CREATE POLICY "meta_delete" ON meta_connections
  FOR DELETE USING (
    get_user_role(workspace_id) IN ('owner', 'admin')
  );

CREATE POLICY "scheduled_select" ON scheduled_posts
  FOR SELECT USING (is_workspace_member(workspace_id));

CREATE POLICY "scheduled_insert" ON scheduled_posts
  FOR INSERT WITH CHECK (
    get_user_role(workspace_id) IN ('owner', 'admin', 'editor')
  );

CREATE POLICY "scheduled_update" ON scheduled_posts
  FOR UPDATE USING (
    get_user_role(workspace_id) IN ('owner', 'admin', 'editor')
  );

CREATE POLICY "scheduled_delete" ON scheduled_posts
  FOR DELETE USING (
    get_user_role(workspace_id) IN ('owner', 'admin')
  );
