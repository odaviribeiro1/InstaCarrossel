import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.0';
import { getCorsHeaders } from '../_shared/cors.ts';
import { OpenAIAdapter } from './adapters/openai.ts';
import { AnthropicAdapter } from './adapters/anthropic.ts';
import { GoogleAdapter } from './adapters/google.ts';
import { GroqAdapter } from './adapters/groq.ts';
import type { LLMAdapter } from './adapters/types.ts';

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
  return `Voce e um especialista em criacao de carrosseis para Instagram.
Gere o conteudo textual para um carrossel com ${params.slideCount} slides.

Categoria do template: ${params.category}
Publico-alvo: ${params.audience || 'geral'}
Tom de voz: ${params.toneOfVoice || 'profissional e acessivel'}

<user_content>
${params.content || params.topic}
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
- Use o idioma portugues do Brasil`;
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
    const {
      workspace_id,
      topic = '',
      content = '',
      audience = '',
      tone_of_voice = '',
      slide_count = 5,
      category = 'educacional',
    } = body;

    // Verify workspace membership
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

    // Get AI config
    const { data: aiConfig } = await adminClient
      .from('ai_configs')
      .select('llm_provider, llm_model, llm_api_key_id, llm_api_key')
      .eq('workspace_id', workspace_id || '')
      .maybeSingle();

    if (!aiConfig) {
      return new Response(JSON.stringify({ error: 'Configuracao de IA nao encontrada' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Retrieve API key: Vault first, then direct column
    let apiKey = '';
    if (aiConfig.llm_api_key_id) {
      try {
        const { data: secretData } = await adminClient.rpc('vault_read', {
          secret_id: aiConfig.llm_api_key_id,
        });
        apiKey = secretData || '';
      } catch {
        // Vault not available
      }
    }
    if (!apiKey && aiConfig.llm_api_key) {
      apiKey = aiConfig.llm_api_key;
    }

    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'API Key nao encontrada. Salve a chave nas configuracoes de IA.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get adapter
    const adapterFactory = adapters[aiConfig.llm_provider];
    if (!adapterFactory) {
      return new Response(JSON.stringify({ error: `Provider nao suportado: ${aiConfig.llm_provider}` }), {
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

    // Parse JSON from response
    let parsedContent;
    try {
      parsedContent = JSON.parse(result.content);
    } catch {
      // Try extracting JSON from markdown code block
      const jsonMatch = result.content.match(/```(?:json)?\s*([\s\S]*?)```/);
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
