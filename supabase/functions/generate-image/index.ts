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
    const { prompt, workspace_id } = body;

    if (!prompt) {
      return new Response(JSON.stringify({ error: 'Prompt e obrigatorio' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Verify workspace membership
    const { data: member } = await adminClient
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspace_id || '')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!member) {
      return new Response(JSON.stringify({ error: 'Acesso negado a este workspace' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get Imagen API key: Vault first, then direct column
    const { data: aiConfig } = await adminClient
      .from('ai_configs')
      .select('imagen_api_key_id, imagen_api_key')
      .eq('workspace_id', workspace_id || '')
      .maybeSingle();

    let apiKey = '';
    if (aiConfig?.imagen_api_key_id) {
      try {
        const { data: secret } = await adminClient.rpc('vault_read', { secret_id: aiConfig.imagen_api_key_id });
        apiKey = secret || '';
      } catch { /* Vault unavailable */ }
    }
    if (!apiKey && aiConfig?.imagen_api_key) {
      apiKey = aiConfig.imagen_api_key;
    }

    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'API Key Gemini Imagen nao configurada. Va em Configuracoes > IA.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Call Gemini Imagen API
    // Try imagen-3.0-generate-002 first, fallback to imagen-3.0-generate-001
    const models = ['imagen-3.0-generate-002', 'imagen-3.0-generate-001'];
    let imageBase64 = '';
    let lastError = '';

    for (const model of models) {
      try {
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict?key=${apiKey}`;
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            instances: [{ prompt }],
            parameters: {
              sampleCount: 1,
              aspectRatio: '4:5',
            },
          }),
        });

        if (!response.ok) {
          const errText = await response.text();
          lastError = `${model}: ${response.status} - ${errText}`;
          continue;
        }

        const data = await response.json();
        imageBase64 = data.predictions?.[0]?.bytesBase64Encoded || '';
        if (imageBase64) break;
        lastError = `${model}: nenhuma imagem no response`;
      } catch (fetchErr) {
        lastError = `${model}: ${String(fetchErr)}`;
      }
    }

    if (!imageBase64) {
      return new Response(
        JSON.stringify({ error: `Falha ao gerar imagem. ${lastError}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        image: `data:image/png;base64,${imageBase64}`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: `Erro interno: ${String(err)}` }),
      { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    );
  }
});
