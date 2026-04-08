import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.0';
import { getCorsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Nao autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

    // Verify user
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Nao autenticado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { workspace_id, llm_provider, llm_model, llm_api_key, imagen_api_key, supadata_api_key } = body;

    // Verify user belongs to workspace
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: member } = await adminClient
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspace_id)
      .eq('user_id', user.id)
      .single();

    if (!member || !['owner', 'admin'].includes(member.role)) {
      return new Response(JSON.stringify({ error: 'Sem permissao' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Delete old vault secrets before inserting new ones
    const { data: existingConfig } = await adminClient
      .from('ai_configs')
      .select('llm_api_key_id, imagen_api_key_id, supadata_api_key_id')
      .eq('workspace_id', workspace_id)
      .maybeSingle();

    if (existingConfig) {
      const oldIds = [
        existingConfig.llm_api_key_id,
        existingConfig.imagen_api_key_id,
        existingConfig.supadata_api_key_id,
      ].filter(Boolean);

      for (const oldId of oldIds) {
        await adminClient.from('vault.secrets').delete().eq('id', oldId).maybeSingle();
      }
    }

    // Store API keys in Vault
    let llmKeyId: string | null = null;
    let imagenKeyId: string | null = null;
    let supadataKeyId: string | null = null;

    if (llm_api_key) {
      const { data } = await adminClient.rpc('vault_insert', {
        new_secret: llm_api_key,
        new_name: `llm_api_key_${workspace_id}`,
      });
      llmKeyId = data;
    }

    if (imagen_api_key) {
      const { data } = await adminClient.rpc('vault_insert', {
        new_secret: imagen_api_key,
        new_name: `imagen_api_key_${workspace_id}`,
      });
      imagenKeyId = data;
    }

    if (supadata_api_key) {
      const { data } = await adminClient.rpc('vault_insert', {
        new_secret: supadata_api_key,
        new_name: `supadata_api_key_${workspace_id}`,
      });
      supadataKeyId = data;
    }

    // Upsert ai_configs
    const { error } = await adminClient.from('ai_configs').upsert(
      {
        workspace_id,
        llm_provider,
        llm_model,
        llm_api_key_id: llmKeyId,
        imagen_api_key_id: imagenKeyId,
        supadata_api_key_id: supadataKeyId,
      },
      { onConflict: 'workspace_id' }
    );

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    });
  }
});
