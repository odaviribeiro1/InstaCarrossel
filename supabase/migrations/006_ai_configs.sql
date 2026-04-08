-- 006_ai_configs.sql
-- Configuracao de IA por workspace com criptografia via Vault

CREATE TABLE IF NOT EXISTS ai_configs (
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

-- RLS
ALTER TABLE ai_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_configs_select" ON ai_configs
  FOR SELECT USING (is_workspace_member(workspace_id));

CREATE POLICY "ai_configs_insert" ON ai_configs
  FOR INSERT WITH CHECK (
    get_user_role(workspace_id) IN ('owner', 'admin')
  );

CREATE POLICY "ai_configs_update" ON ai_configs
  FOR UPDATE USING (
    get_user_role(workspace_id) IN ('owner', 'admin')
  );

CREATE POLICY "ai_configs_delete" ON ai_configs
  FOR DELETE USING (
    get_user_role(workspace_id) = 'owner'
  );
