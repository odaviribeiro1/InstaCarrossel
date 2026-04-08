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
    const { meta_app_id, meta_app_secret } = body;

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Verify user is owner or admin of at least one workspace
    const { data: member } = await adminClient
      .from('workspace_members')
      .select('role')
      .eq('user_id', user.id)
      .in('role', ['owner', 'admin'])
      .limit(1)
      .maybeSingle();

    if (!member) {
      return new Response(JSON.stringify({ error: 'Acesso negado. Apenas owner ou admin podem alterar configuracoes Meta.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Try to store App Secret in Vault, fallback to direct column
    let secretId: string | null = null;
    let directSecret: string | null = null;

    if (meta_app_secret) {
      try {
        const { data, error: vaultError } = await adminClient.rpc('vault_insert', {
          new_secret: meta_app_secret,
          new_name: 'meta_app_secret',
        });
        if (vaultError || !data) {
          // Vault not available — store directly
          directSecret = meta_app_secret;
        } else {
          secretId = data;
        }
      } catch {
        // Vault extension not installed — store directly
        directSecret = meta_app_secret;
      }
    }

    // Update platform_config
    const updateData: Record<string, unknown> = { meta_app_id };
    if (secretId) {
      updateData.meta_app_secret_id = secretId;
    }
    if (directSecret) {
      updateData.meta_app_secret = directSecret;
    }

    const { error } = await adminClient
      .from('platform_config')
      .update(updateData)
      .not('id', 'is', null);

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
