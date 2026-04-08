import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.0';
import { getCorsHeaders } from '../_shared/cors.ts';

function detectUrlType(url: string): 'youtube' | 'reels' | 'twitter' | 'direct' {
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
  if (url.includes('instagram.com/reel') || url.includes('instagram.com/p/')) return 'reels';
  if (url.includes('twitter.com') || url.includes('x.com')) return 'twitter';
  return 'direct';
}

function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const match = url.match(p);
    if (match?.[1]) return match[1];
  }
  return null;
}

async function getMetaAccessToken(
  adminClient: ReturnType<typeof createClient>,
  workspaceId: string
): Promise<{ token: string | null; igUserId: string | null }> {
  const { data: conn } = await adminClient
    .from('meta_connections')
    .select('access_token_id, access_token, ig_user_id')
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  if (!conn) return { token: null, igUserId: null };

  // Try Vault first
  if (conn.access_token_id) {
    try {
      const { data: vaultToken } = await adminClient.rpc('vault_read', {
        secret_id: conn.access_token_id,
      });
      if (vaultToken) return { token: vaultToken, igUserId: conn.ig_user_id };
    } catch {
      // Vault not available
    }
  }

  // Fallback to direct column
  if (conn.access_token) return { token: conn.access_token, igUserId: conn.ig_user_id };

  return { token: null, igUserId: conn.ig_user_id };
}

async function fetchReelCaption(url: string, accessToken: string): Promise<string | null> {
  // Use Instagram oEmbed via Graph API
  try {
    const oembedResponse = await fetch(
      `https://graph.facebook.com/v19.0/instagram_oembed?url=${encodeURIComponent(url)}&access_token=${accessToken}`
    );
    if (oembedResponse.ok) {
      const data = await oembedResponse.json();
      // oEmbed returns HTML with caption embedded — extract title/author_name
      if (data.title) return data.title;
      if (data.author_name) return `Post de @${data.author_name}`;
    }
  } catch {
    // oEmbed failed
  }

  // Fallback: fetch recent media and match by URL shortcode
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

    // Get Supadata API key from Vault
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

      // Try Supadata API
      if (aiConfig?.supadata_api_key_id) {
        const { data: supadataKey } = await adminClient.rpc('vault_read', {
          secret_id: aiConfig.supadata_api_key_id,
        });

        if (supadataKey) {
          const response = await fetch(
            `https://api.supadata.ai/v1/youtube/transcript?videoId=${videoId}&lang=pt`,
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

    if (urlType === 'reels') {
      // Try Meta Graph API with stored access token
      const { token } = await getMetaAccessToken(adminClient, workspace_id || '');

      if (token) {
        try {
          const caption = await fetchReelCaption(url, token);
          if (caption) {
            return new Response(
              JSON.stringify({ transcript: caption, source: 'instagram_graph_api' }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        } catch (err) {
          console.error('Meta Graph API error:', err);
        }
      }

      // Fallback: try noembed for caption
      try {
        const noembedResponse = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(url)}`);
        if (noembedResponse.ok) {
          const noembedData = await noembedResponse.json();
          if (noembedData.title) {
            return new Response(
              JSON.stringify({ transcript: noembedData.title, source: 'caption' }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }
      } catch {
        // noembed failed
      }

      return new Response(
        JSON.stringify({
          error: token
            ? 'Nao foi possivel extrair conteudo do Reel. Tente colar o texto manualmente.'
            : 'Conecte o Instagram nas configuracoes para extrair conteudo de Reels.',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (urlType === 'twitter') {
      return new Response(
        JSON.stringify({ error: 'Transcricao de Twitter/X em implementacao. Cole o texto da thread manualmente.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Tipo de URL nao suportado. Use YouTube, Reels ou cole o texto manualmente.' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    });
  }
});
