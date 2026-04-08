/**
 * Bundled Edge Function source code for automatic deployment.
 *
 * Each function has the shared CORS code inlined so it is fully self-contained
 * and can be deployed individually via the Supabase Management API.
 */

export interface EdgeFunctionBundle {
  slug: string;
  name: string;
  source: string;
  verifyJwt: boolean;
}

// ---------------------------------------------------------------------------
// Shared CORS code — inlined into every function that needs it
// ---------------------------------------------------------------------------
const CORS_INLINE = `
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.0';

function isAllowedOriginStatic(origin: string): boolean {
  if (!origin) return false;
  if (/^https?:\\/\\/localhost(:\\d+)?$/.test(origin)) return true;
  if (/^https?:\\/\\/127\\.0\\.0\\.1(:\\d+)?$/.test(origin)) return true;
  if (/^https:\\/\\/[a-z0-9-]+\\.supabase\\.co$/.test(origin)) return true;
  if (/^https:\\/\\/[a-z0-9-]+\\.vercel\\.app$/.test(origin)) return true;
  return false;
}

let customDomainCache: string[] = [];
let cacheTimestamp = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

async function loadCustomDomains(): Promise<string[]> {
  const now = Date.now();
  if (now - cacheTimestamp < CACHE_TTL_MS && customDomainCache.length > 0) {
    return customDomainCache;
  }
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) return customDomainCache;
    const client = createClient(supabaseUrl, serviceRoleKey);
    const { data } = await client
      .from('workspaces')
      .select('custom_domain')
      .not('custom_domain', 'is', null);
    customDomainCache = (data || [])
      .map((w: { custom_domain: string | null }) => w.custom_domain)
      .filter((d): d is string => d !== null);
    cacheTimestamp = now;
  } catch {
    // Keep existing cache on error
  }
  return customDomainCache;
}

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? '';
  let allowedOrigin = isAllowedOriginStatic(origin) ? origin : '';
  if (!allowedOrigin && origin) {
    try {
      const originHost = new URL(origin).hostname;
      if (customDomainCache.includes(originHost)) {
        allowedOrigin = origin;
      }
    } catch {
      // Invalid origin URL
    }
    loadCustomDomains().catch(() => {});
  }
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  };
}
`;

// ---------------------------------------------------------------------------
// Individual Edge Functions
// ---------------------------------------------------------------------------

const bootstrapSource = `${CORS_INLINE}

interface MigrationPayload {
  version: string;
  description: string;
  sql: string;
}

interface MigrationResult {
  version: string;
  status: 'success' | 'already_executed' | 'error';
  error?: string;
}

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Token de autorizacao ausente' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: 'Variaveis de ambiente do Supabase nao configuradas' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Usuario nao autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const body = await req.json();

    if (body.action === 'init_platform_config' && body.payload) {
      const { supabase_url, supabase_anon_key } = body.payload as {
        supabase_url: string;
        supabase_anon_key: string;
      };

      const { error: insertError } = await adminClient
        .from('platform_config')
        .insert({
          supabase_url,
          supabase_anon_key,
          setup_step: 1,
          setup_completed: false,
        })
        .select('id')
        .maybeSingle();

      if (insertError && !insertError.message?.includes('duplicate')) {
        return new Response(
          JSON.stringify({ error: insertError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const migrationsList: MigrationPayload[] = body.migrations;

    if (!Array.isArray(migrationsList) || migrationsList.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Lista de migrations invalida' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results: MigrationResult[] = [];

    for (const migration of migrationsList) {
      if (!migration.version || !migration.sql) {
        results.push({
          version: migration.version || 'unknown',
          status: 'error',
          error: 'Migration sem version ou sql',
        });
        continue;
      }

      if (migration.version !== '001_extensions' &&
          migration.version !== '002_platform_config' &&
          migration.version !== '003_schema_versions') {
        const { data: existing } = await adminClient
          .from('schema_versions')
          .select('version')
          .eq('version', migration.version)
          .eq('success', true)
          .maybeSingle();

        if (existing) {
          results.push({ version: migration.version, status: 'already_executed' });
          continue;
        }
      }

      try {
        if (migration.version === '001_extensions') {
          const urlMatch = supabaseUrl.match(/https:\\/\\/([^.]+)\\.supabase\\.co/);

          if (urlMatch) {
            const projectRef = urlMatch[1];
            const mgmtResponse = await fetch(
              \`https://api.supabase.com/v1/projects/\${projectRef}/database/query\`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': \`Bearer \${serviceRoleKey}\`,
                },
                body: JSON.stringify({ query: migration.sql }),
              }
            );

            if (!mgmtResponse.ok) {
              const pgResponse = await fetch(\`\${supabaseUrl}/rest/v1/\`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'apikey': serviceRoleKey,
                  'Authorization': \`Bearer \${serviceRoleKey}\`,
                  'Prefer': 'return=minimal',
                },
                body: migration.sql,
              });

              if (!pgResponse.ok) {
                throw new Error(
                  'Nao foi possivel executar migration 001. ' +
                  'Execute manualmente no Supabase SQL Editor: ' +
                  'Dashboard > SQL Editor > Cole o SQL da migration 001_extensions'
                );
              }
            }
          } else {
            const { error } = await adminClient.rpc('exec_sql', { query: migration.sql });
            if (error) {
              throw new Error(
                'Nao foi possivel executar migration 001. ' +
                'Execute manualmente no Supabase SQL Editor.'
              );
            }
          }
        } else {
          const { error: execError } = await adminClient.rpc('exec_sql', {
            query: migration.sql,
          });

          if (execError) {
            throw new Error(\`exec_sql failed: \${execError.message}\`);
          }
        }

        try {
          await adminClient.from('schema_versions').insert({
            version: migration.version,
            description: migration.description,
            success: true,
          });
        } catch {
          // schema_versions may not exist yet for early migrations
        }

        results.push({ version: migration.version, status: 'success' });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);

        try {
          await adminClient.from('schema_versions').insert({
            version: migration.version,
            description: migration.description,
            success: false,
            error_message: errorMessage,
          });
        } catch {
          // Ignore if schema_versions doesn't exist yet
        }

        results.push({
          version: migration.version,
          status: 'error',
          error: errorMessage,
        });
      }
    }

    return new Response(
      JSON.stringify({ results }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
`;

const generateContentSource = `${CORS_INLINE}

// ---- Adapter Types ----
interface LLMConfig {
  apiKey: string;
  model: string;
  maxTokens?: number;
}

interface LLMResponse {
  content: string;
}

interface LLMAdapter {
  generateContent(prompt: string, config: LLMConfig): Promise<LLMResponse>;
}

// ---- OpenAI Adapter ----
class OpenAIAdapter implements LLMAdapter {
  async generateContent(prompt: string, config: LLMConfig): Promise<LLMResponse> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': \`Bearer \${config.apiKey}\`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: config.maxTokens ?? 2000,
        response_format: { type: 'json_object' },
      }),
    });
    if (!response.ok) {
      const err = await response.text();
      throw new Error(\`OpenAI error: \${err}\`);
    }
    const data = await response.json();
    return { content: data.choices[0].message.content };
  }
}

// ---- Anthropic Adapter ----
class AnthropicAdapter implements LLMAdapter {
  async generateContent(prompt: string, config: LLMConfig): Promise<LLMResponse> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: config.maxTokens ?? 2000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!response.ok) {
      const err = await response.text();
      throw new Error(\`Anthropic error: \${err}\`);
    }
    const data = await response.json();
    const textBlock = data.content.find((b: { type: string }) => b.type === 'text');
    return { content: textBlock?.text ?? '' };
  }
}

// ---- Google Adapter ----
class GoogleAdapter implements LLMAdapter {
  async generateContent(prompt: string, config: LLMConfig): Promise<LLMResponse> {
    const response = await fetch(
      \`https://generativelanguage.googleapis.com/v1beta/models/\${config.model}:generateContent?key=\${config.apiKey}\`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: config.maxTokens ?? 2000,
            responseMimeType: 'application/json',
          },
        }),
      }
    );
    if (!response.ok) {
      const err = await response.text();
      throw new Error(\`Google AI error: \${err}\`);
    }
    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    return { content: text };
  }
}

// ---- Groq Adapter ----
class GroqAdapter implements LLMAdapter {
  async generateContent(prompt: string, config: LLMConfig): Promise<LLMResponse> {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': \`Bearer \${config.apiKey}\`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: config.maxTokens ?? 2000,
        response_format: { type: 'json_object' },
      }),
    });
    if (!response.ok) {
      const err = await response.text();
      throw new Error(\`Groq error: \${err}\`);
    }
    const data = await response.json();
    return { content: data.choices[0].message.content };
  }
}

const adapters: Record<string, () => LLMAdapter> = {
  openai: () => new OpenAIAdapter(),
  anthropic: () => new AnthropicAdapter(),
  google: () => new GoogleAdapter(),
  groq: () => new GroqAdapter(),
};

function buildPrompt(params: {
  content: string;
  topic: string;
  toneOfVoice: string;
  audience: string;
  slideCount: number;
  category: string;
}): string {
  return \`Voce e um especialista em criacao de carrosseis para Instagram.
Gere o conteudo textual para um carrossel com \${params.slideCount} slides.

Categoria do template: \${params.category}
Publico-alvo: \${params.audience || 'geral'}
Tom de voz: \${params.toneOfVoice || 'profissional e acessivel'}

<user_content>
\${params.content || params.topic}
</user_content>

Retorne APENAS um JSON valido no formato abaixo, sem texto adicional:
{
  "slides": [
    {
      "position": 1,
      "type": "capa",
      "headline": "Titulo impactante do carrossel",
      "body": "Subtitulo ou descricao breve",
      "cta": "",
      "notes": ""
    },
    {
      "position": 2,
      "type": "conteudo",
      "headline": "Titulo do slide",
      "body": "Conteudo principal do slide com informacoes relevantes",
      "cta": "",
      "notes": ""
    }
  ]
}

Regras:
- O primeiro slide deve ser tipo "capa" com titulo impactante
- Os slides intermediarios devem ser tipo "conteudo"
- O ultimo slide deve ser tipo "cta" com call-to-action
- Cada headline deve ter no maximo 60 caracteres
- Cada body deve ter no maximo 200 caracteres
- O conteudo deve ser relevante, engajante e adequado ao tom de voz
- Use o idioma portugues do Brasil\`;
}

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
    const {
      workspace_id,
      topic = '',
      content = '',
      audience = '',
      tone_of_voice = '',
      slide_count = 5,
      category = 'educacional',
    } = body;

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
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

    const { data: aiConfig } = await adminClient
      .from('ai_configs')
      .select('llm_provider, llm_model, llm_api_key_id')
      .eq('workspace_id', workspace_id || '')
      .maybeSingle();

    if (!aiConfig) {
      return new Response(JSON.stringify({ error: 'Configuracao de IA nao encontrada' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let apiKey = '';
    if (aiConfig.llm_api_key_id) {
      const { data: secretData } = await adminClient.rpc('vault_read', {
        secret_id: aiConfig.llm_api_key_id,
      });
      apiKey = secretData || '';
    }

    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'API Key nao encontrada' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const adapterFactory = adapters[aiConfig.llm_provider];
    if (!adapterFactory) {
      return new Response(JSON.stringify({ error: \`Provider nao suportado: \${aiConfig.llm_provider}\` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const adapter = adapterFactory();
    const prompt = buildPrompt({
      content,
      topic,
      toneOfVoice: tone_of_voice,
      audience,
      slideCount: slide_count,
      category,
    });

    const result = await adapter.generateContent(prompt, {
      apiKey,
      model: aiConfig.llm_model,
      maxTokens: Math.min(slide_count * 400, 4000),
    });

    let parsedContent;
    try {
      parsedContent = JSON.parse(result.content);
    } catch {
      const jsonMatch = result.content.match(/\\\`\\\`\\\`(?:json)?\\s*([\\s\\S]*?)\\\`\\\`\\\`/);
      if (jsonMatch?.[1]) {
        parsedContent = JSON.parse(jsonMatch[1]);
      } else {
        throw new Error('Resposta da IA nao e JSON valido');
      }
    }

    return new Response(JSON.stringify(parsedContent), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    });
  }
});
`;

const generateImageSource = `${CORS_INLINE}

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

    const { data: aiConfig } = await adminClient
      .from('ai_configs')
      .select('imagen_api_key_id')
      .eq('workspace_id', workspace_id || '')
      .maybeSingle();

    if (!aiConfig?.imagen_api_key_id) {
      return new Response(JSON.stringify({ error: 'API Key Gemini Imagen nao configurada' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: apiKey } = await adminClient.rpc('vault_read', {
      secret_id: aiConfig.imagen_api_key_id,
    });

    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'API Key nao encontrada no Vault' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const response = await fetch(
      \`https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=\${apiKey}\`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instances: [{ prompt }],
          parameters: {
            sampleCount: 1,
            aspectRatio: '4:5',
          },
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      throw new Error(\`Gemini Imagen error: \${err}\`);
    }

    const data = await response.json();
    const imageBase64 = data.predictions?.[0]?.bytesBase64Encoded;

    if (!imageBase64) {
      throw new Error('Nenhuma imagem gerada');
    }

    return new Response(
      JSON.stringify({
        image: \`data:image/png;base64,\${imageBase64}\`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    });
  }
});
`;

const metaOauthSource = `${CORS_INLINE}

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
    const { code, redirect_uri, workspace_id } = body;

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: member } = await adminClient
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspace_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!member) {
      return new Response(JSON.stringify({ error: 'Acesso negado a este workspace' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: config } = await adminClient
      .from('platform_config')
      .select('meta_app_id, meta_app_secret_id')
      .limit(1)
      .single();

    if (!config?.meta_app_id || !config?.meta_app_secret_id) {
      return new Response(JSON.stringify({ error: 'Credenciais Meta nao configuradas' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: secretData } = await adminClient.rpc('vault_read', {
      secret_id: config.meta_app_secret_id,
    });

    const appSecret = secretData;
    if (!appSecret) {
      return new Response(JSON.stringify({ error: 'App Secret nao encontrado no Vault' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const tokenUrl = \`https://graph.facebook.com/v19.0/oauth/access_token?client_id=\${config.meta_app_id}&client_secret=\${appSecret}&code=\${code}&redirect_uri=\${encodeURIComponent(redirect_uri)}\`;

    const tokenResponse = await fetch(tokenUrl);
    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      return new Response(JSON.stringify({ error: tokenData.error.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const accessToken = tokenData.access_token;
    const expiresIn = tokenData.expires_in;

    const longLivedUrl = \`https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=\${config.meta_app_id}&client_secret=\${appSecret}&fb_exchange_token=\${accessToken}\`;

    const longLivedResponse = await fetch(longLivedUrl);
    const longLivedData = await longLivedResponse.json();

    const finalToken = longLivedData.access_token || accessToken;
    const finalExpiry = longLivedData.expires_in || expiresIn;

    const pagesResponse = await fetch(\`https://graph.facebook.com/v19.0/me/accounts?access_token=\${finalToken}\`);
    const pagesData = await pagesResponse.json();

    const pages = [];
    for (const page of (pagesData.data || [])) {
      const igResponse = await fetch(
        \`https://graph.facebook.com/v19.0/\${page.id}?fields=instagram_business_account&access_token=\${finalToken}\`
      );
      const igData = await igResponse.json();

      pages.push({
        page_id: page.id,
        page_name: page.name,
        ig_user_id: igData.instagram_business_account?.id || null,
      });
    }

    const { data: tokenId } = await adminClient.rpc('vault_insert', {
      new_secret: finalToken,
      new_name: \`meta_access_token_\${workspace_id}\`,
    });

    const expiresAt = new Date(Date.now() + (finalExpiry || 5184000) * 1000).toISOString();

    const { error: connError } = await adminClient.from('meta_connections').upsert(
      {
        workspace_id,
        user_id: user.id,
        access_token_id: tokenId,
        ig_user_id: pages[0]?.ig_user_id || null,
        fb_page_id: pages[0]?.page_id || null,
        token_expires_at: expiresAt,
      },
      { onConflict: 'workspace_id,user_id' }
    );

    if (connError) {
      return new Response(JSON.stringify({ error: connError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({ success: true, pages }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    });
  }
});
`;

const schedulePostSource = `${CORS_INLINE}

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Token de autorizacao ausente' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Usuario nao autenticado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    const { carousel_id, workspace_id } = body;

    const { data: membership } = await adminClient
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspace_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!membership) {
      return new Response(JSON.stringify({ error: 'Acesso negado a este workspace' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: carousel } = await adminClient
      .from('carousels')
      .select('id')
      .eq('id', carousel_id)
      .eq('workspace_id', workspace_id)
      .maybeSingle();

    if (!carousel) {
      return new Response(JSON.stringify({ error: 'Carrossel nao encontrado neste workspace' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: metaConn } = await adminClient
      .from('meta_connections')
      .select('access_token_id, ig_user_id')
      .eq('workspace_id', workspace_id)
      .maybeSingle();

    if (!metaConn?.access_token_id || !metaConn?.ig_user_id) {
      return new Response(JSON.stringify({ error: 'Conexao Instagram nao encontrada' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: accessToken } = await adminClient.rpc('vault_read', {
      secret_id: metaConn.access_token_id,
    });

    if (!accessToken) {
      return new Response(JSON.stringify({ error: 'Token de acesso nao encontrado' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: slides } = await adminClient
      .from('carousel_slides')
      .select('export_url, position')
      .eq('carousel_id', carousel_id)
      .order('position', { ascending: true });

    if (!slides || slides.length === 0) {
      return new Response(JSON.stringify({ error: 'Nenhum slide exportado' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (slides.length > 10) {
      return new Response(JSON.stringify({ error: 'Maximo de 10 slides por carrossel' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await adminClient
      .from('carousels')
      .update({ status: 'scheduled' })
      .eq('id', carousel_id);

    const mediaIds: string[] = [];
    for (const slide of slides) {
      if (!slide.export_url) continue;

      const mediaResponse = await fetch(
        \`https://graph.facebook.com/v19.0/\${metaConn.ig_user_id}/media\`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image_url: slide.export_url,
            is_carousel_item: true,
            access_token: accessToken,
          }),
        }
      );

      const mediaData = await mediaResponse.json();
      if (mediaData.id) {
        mediaIds.push(mediaData.id);
      } else {
        throw new Error(\`Erro ao upload media: \${JSON.stringify(mediaData)}\`);
      }
    }

    const containerResponse = await fetch(
      \`https://graph.facebook.com/v19.0/\${metaConn.ig_user_id}/media\`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          media_type: 'CAROUSEL',
          children: mediaIds.join(','),
          access_token: accessToken,
        }),
      }
    );

    const containerData = await containerResponse.json();
    if (!containerData.id) {
      throw new Error(\`Erro ao criar container: \${JSON.stringify(containerData)}\`);
    }

    const publishResponse = await fetch(
      \`https://graph.facebook.com/v19.0/\${metaConn.ig_user_id}/media_publish\`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creation_id: containerData.id,
          access_token: accessToken,
        }),
      }
    );

    const publishData = await publishResponse.json();

    if (publishData.id) {
      await adminClient
        .from('carousels')
        .update({
          status: 'published',
          meta_post_id: publishData.id,
          published_at: new Date().toISOString(),
        })
        .eq('id', carousel_id);

      return new Response(JSON.stringify({ success: true, post_id: publishData.id }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else {
      throw new Error(\`Erro ao publicar: \${JSON.stringify(publishData)}\`);
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    });
  }
});
`;

const storeAiConfigSource = `${CORS_INLINE}

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
    const { workspace_id, llm_provider, llm_model, llm_api_key, imagen_api_key, supadata_api_key } = body;

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

    let llmKeyId: string | null = null;
    let imagenKeyId: string | null = null;
    let supadataKeyId: string | null = null;

    if (llm_api_key) {
      const { data } = await adminClient.rpc('vault_insert', {
        new_secret: llm_api_key,
        new_name: \`llm_api_key_\${workspace_id}\`,
      });
      llmKeyId = data;
    }

    if (imagen_api_key) {
      const { data } = await adminClient.rpc('vault_insert', {
        new_secret: imagen_api_key,
        new_name: \`imagen_api_key_\${workspace_id}\`,
      });
      imagenKeyId = data;
    }

    if (supadata_api_key) {
      const { data } = await adminClient.rpc('vault_insert', {
        new_secret: supadata_api_key,
        new_name: \`supadata_api_key_\${workspace_id}\`,
      });
      supadataKeyId = data;
    }

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
`;

const storeMetaConfigSource = `${CORS_INLINE}

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
    const { meta_app_id, meta_app_secret, workspace_id } = body;

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    if (!workspace_id) {
      return new Response(JSON.stringify({ error: 'workspace_id e obrigatorio' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: member } = await adminClient
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspace_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!member || !['owner', 'admin'].includes(member.role)) {
      return new Response(JSON.stringify({ error: 'Acesso negado. Apenas owner ou admin podem alterar configuracoes Meta.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let secretId: string | null = null;
    if (meta_app_secret) {
      const { data } = await adminClient.rpc('vault_insert', {
        new_secret: meta_app_secret,
        new_name: 'meta_app_secret',
      });
      secretId = data;
    }

    const { error } = await adminClient
      .from('platform_config')
      .update({
        meta_app_id,
        meta_app_secret_id: secretId,
      })
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
`;

const transcribeSource = `${CORS_INLINE}

function detectUrlType(url: string): 'youtube' | 'reels' | 'twitter' | 'direct' {
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
  if (url.includes('instagram.com/reel') || url.includes('instagram.com/p/')) return 'reels';
  if (url.includes('twitter.com') || url.includes('x.com')) return 'twitter';
  return 'direct';
}

function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\\.com\\/watch\\?v=|youtu\\.be\\/)([a-zA-Z0-9_-]{11})/,
    /youtube\\.com\\/embed\\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const match = url.match(p);
    if (match?.[1]) return match[1];
  }
  return null;
}

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
    const { url, workspace_id } = body;

    if (!url) {
      return new Response(JSON.stringify({ error: 'URL e obrigatoria' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

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

    const { data: aiConfig } = await adminClient
      .from('ai_configs')
      .select('supadata_api_key_id')
      .eq('workspace_id', workspace_id || '')
      .maybeSingle();

    const urlType = detectUrlType(url);

    if (urlType === 'youtube') {
      const videoId = extractYouTubeId(url);
      if (!videoId) {
        return new Response(JSON.stringify({ error: 'URL do YouTube invalida' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (aiConfig?.supadata_api_key_id) {
        const { data: supadataKey } = await adminClient.rpc('vault_read', {
          secret_id: aiConfig.supadata_api_key_id,
        });

        if (supadataKey) {
          const response = await fetch(
            \`https://api.supadata.ai/v1/youtube/transcript?videoId=\${videoId}&lang=pt\`,
            {
              headers: { 'x-api-key': supadataKey },
            }
          );

          if (response.ok) {
            const data = await response.json();
            const transcript = data.content || data.text || JSON.stringify(data);
            return new Response(
              JSON.stringify({ transcript, source: 'supadata' }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }
      }

      return new Response(
        JSON.stringify({ error: 'Nao foi possivel transcrever. Verifique a API key da Supadata.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        error: \`Transcricao de \${urlType} requer Whisper API. Funcionalidade em implementacao.\`,
      }),
      { status: 501, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    });
  }
});
`;

const webhookMetaSource = `${CORS_INLINE}

async function computeHmacSha256(secret: string, payload: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const encoder = new TextEncoder();
  const bufA = encoder.encode(a);
  const bufB = encoder.encode(b);
  let result = 0;
  for (let i = 0; i < bufA.length; i++) {
    result |= bufA[i] ^ bufB[i];
  }
  return result === 0;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');

    const verifyToken = Deno.env.get('META_VERIFY_TOKEN');
    if (
      mode === 'subscribe' &&
      token &&
      challenge &&
      verifyToken &&
      timingSafeEqual(token, verifyToken)
    ) {
      return new Response(challenge, { status: 200 });
    }

    return new Response('Forbidden', { status: 403 });
  }

  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const rawBody = await req.text();

    const signatureHeader = req.headers.get('X-Hub-Signature-256');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: config } = await adminClient
      .from('platform_config')
      .select('meta_app_secret_id')
      .limit(1)
      .single();

    let appSecret = '';
    if (config?.meta_app_secret_id) {
      const { data: secretData } = await adminClient.rpc('vault_read', {
        secret_id: config.meta_app_secret_id,
      });
      appSecret = secretData || '';
    }

    if (appSecret && signatureHeader) {
      const expectedSig = await computeHmacSha256(appSecret, rawBody);
      const receivedSig = signatureHeader.replace('sha256=', '');

      if (!timingSafeEqual(expectedSig, receivedSig)) {
        console.error('Webhook signature mismatch');
        return new Response('Forbidden', { status: 403 });
      }
    } else if (appSecret && !signatureHeader) {
      console.error('Missing X-Hub-Signature-256 header');
      return new Response('Forbidden', { status: 403 });
    }

    const body = JSON.parse(rawBody);

    if (body.entry) {
      for (const entry of body.entry) {
        if (entry.changes) {
          for (const change of entry.changes) {
            if (change.field === 'media' && change.value?.media_id) {
              await adminClient
                .from('carousels')
                .update({ status: 'published' })
                .eq('meta_post_id', change.value.media_id);
            }
          }
        }
      }
    }

    return new Response('OK', {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
    });
  } catch (err) {
    console.error('Webhook error:', err);
    return new Response('OK', { status: 200 });
  }
});
`;

// ---------------------------------------------------------------------------
// Export all bundled functions
// ---------------------------------------------------------------------------
export const edgeFunctions: EdgeFunctionBundle[] = [
  {
    slug: 'bootstrap',
    name: 'bootstrap',
    source: bootstrapSource,
    verifyJwt: false,
  },
  {
    slug: 'generate-content',
    name: 'generate-content',
    source: generateContentSource,
    verifyJwt: false,
  },
  {
    slug: 'generate-image',
    name: 'generate-image',
    source: generateImageSource,
    verifyJwt: false,
  },
  {
    slug: 'meta-oauth',
    name: 'meta-oauth',
    source: metaOauthSource,
    verifyJwt: false,
  },
  {
    slug: 'schedule-post',
    name: 'schedule-post',
    source: schedulePostSource,
    verifyJwt: false,
  },
  {
    slug: 'store-ai-config',
    name: 'store-ai-config',
    source: storeAiConfigSource,
    verifyJwt: false,
  },
  {
    slug: 'store-meta-config',
    name: 'store-meta-config',
    source: storeMetaConfigSource,
    verifyJwt: false,
  },
  {
    slug: 'transcribe',
    name: 'transcribe',
    source: transcribeSource,
    verifyJwt: false,
  },
  {
    slug: 'webhook-meta',
    name: 'webhook-meta',
    source: webhookMetaSource,
    verifyJwt: false,
  },
];
