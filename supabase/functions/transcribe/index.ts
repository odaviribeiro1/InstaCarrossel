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

interface ApifyReelResult {
  caption: string | null;
  audioUrl: string | null;
  videoUrl: string | null;
  ownerUsername: string | null;
}

async function scrapeReelViaApify(reelUrl: string, apifyToken: string): Promise<ApifyReelResult> {
  const response = await fetch(
    `https://api.apify.com/v2/acts/apify~instagram-api-scraper/run-sync-get-dataset-items?token=${apifyToken}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        directUrls: [reelUrl],
        resultsType: 'posts',
        resultsLimit: 1,
      }),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Apify error ${response.status}: ${text}`);
  }

  const items = await response.json();
  const item = items?.[0];

  if (!item) throw new Error('Nenhum resultado retornado pela Apify');

  return {
    caption: item.caption || null,
    audioUrl: item.audioUrl || null,
    videoUrl: item.videoUrl || null,
    ownerUsername: item.ownerUsername || null,
  };
}

async function transcribeAudioWithWhisper(audioUrl: string, openaiKey: string): Promise<string> {
  // Download audio
  const audioResponse = await fetch(audioUrl);
  if (!audioResponse.ok) throw new Error('Falha ao baixar audio do Reel');
  const audioBlob = await audioResponse.blob();

  // Send to Whisper
  const formData = new FormData();
  formData.append('file', audioBlob, 'audio.mp4');
  formData.append('model', 'whisper-1');
  formData.append('response_format', 'verbose_json');
  formData.append('timestamp_granularities[]', 'segment');

  const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${openaiKey}` },
    body: formData,
  });

  if (!whisperResponse.ok) {
    const errText = await whisperResponse.text();
    throw new Error(`Whisper error ${whisperResponse.status}: ${errText}`);
  }

  const result = await whisperResponse.json();
  return result.text || '';
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
    const { url, workspace_id, transcribe_audio } = body;

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

    const urlType = detectUrlType(url);

    // ========== YOUTUBE ==========
    if (urlType === 'youtube') {
      const videoId = extractYouTubeId(url);
      if (!videoId) {
        return new Response(JSON.stringify({ error: 'URL do YouTube invalida' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Get Supadata API key
      const { data: aiConfig } = await adminClient
        .from('ai_configs')
        .select('supadata_api_key_id')
        .eq('workspace_id', workspace_id || '')
        .maybeSingle();

      if (aiConfig?.supadata_api_key_id) {
        try {
          const { data: supadataKey } = await adminClient.rpc('vault_read', {
            secret_id: aiConfig.supadata_api_key_id,
          });

          if (supadataKey) {
            const response = await fetch(
              `https://api.supadata.ai/v1/youtube/transcript?videoId=${videoId}&lang=pt`,
              { headers: { 'x-api-key': supadataKey } }
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
        } catch {
          // Vault/Supadata failed
        }
      }

      return new Response(
        JSON.stringify({ error: 'Nao foi possivel transcrever. Verifique a API key da Supadata nas configuracoes de IA.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========== REELS ==========
    if (urlType === 'reels') {
      const apifyToken = Deno.env.get('APIFY_TOKEN');
      if (!apifyToken) {
        return new Response(
          JSON.stringify({ error: 'APIFY_TOKEN nao configurado no servidor.' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Scrape reel via Apify
      const reel = await scrapeReelViaApify(url, apifyToken);

      // If caption exists and audio transcription not explicitly requested, return caption
      if (reel.caption && !transcribe_audio) {
        return new Response(
          JSON.stringify({
            transcript: reel.caption,
            source: 'instagram_caption',
            owner: reel.ownerUsername,
            hasAudio: Boolean(reel.audioUrl || reel.videoUrl),
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Transcribe audio via Whisper if requested or caption empty
      const audioSource = reel.audioUrl || reel.videoUrl;
      if (audioSource) {
        // Get OpenAI key from ai_configs
        const { data: aiConfig } = await adminClient
          .from('ai_configs')
          .select('llm_provider, llm_api_key_id')
          .eq('workspace_id', workspace_id || '')
          .maybeSingle();

        let openaiKey: string | null = null;

        if (aiConfig?.llm_api_key_id) {
          try {
            const { data: key } = await adminClient.rpc('vault_read', {
              secret_id: aiConfig.llm_api_key_id,
            });
            if (key) openaiKey = key;
          } catch {
            // Vault failed
          }
        }

        // Fallback: check env var
        if (!openaiKey) {
          openaiKey = Deno.env.get('OPENAI_API_KEY') || null;
        }

        if (openaiKey) {
          try {
            const whisperTranscript = await transcribeAudioWithWhisper(audioSource, openaiKey);
            return new Response(
              JSON.stringify({
                transcript: whisperTranscript,
                source: 'whisper',
                owner: reel.ownerUsername,
                caption: reel.caption,
              }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          } catch (err) {
            console.error('Whisper transcription error:', err);
            // If Whisper fails but we have caption, return caption
            if (reel.caption) {
              return new Response(
                JSON.stringify({
                  transcript: reel.caption,
                  source: 'instagram_caption',
                  owner: reel.ownerUsername,
                  whisperError: String(err),
                }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }
          }
        } else if (reel.caption) {
          // No OpenAI key but have caption
          return new Response(
            JSON.stringify({
              transcript: reel.caption,
              source: 'instagram_caption',
              owner: reel.ownerUsername,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // If we have caption as last resort
      if (reel.caption) {
        return new Response(
          JSON.stringify({ transcript: reel.caption, source: 'instagram_caption', owner: reel.ownerUsername }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ error: 'Nao foi possivel extrair conteudo do Reel.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========== TWITTER ==========
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
