import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.0';
import { getCorsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

    // Verify authentication
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

    // Verify workspace membership
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

    // Verify carousel belongs to workspace
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

    // Get Meta connection
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

    // Get access token from Vault
    const { data: accessToken } = await adminClient.rpc('vault_read', {
      secret_id: metaConn.access_token_id,
    });

    if (!accessToken) {
      return new Response(JSON.stringify({ error: 'Token de acesso nao encontrado' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get carousel slides
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

    // Update status to publishing
    await adminClient
      .from('carousels')
      .update({ status: 'scheduled' })
      .eq('id', carousel_id);

    // Upload each image as media object
    const mediaIds: string[] = [];
    for (const slide of slides) {
      if (!slide.export_url) continue;

      const mediaResponse = await fetch(
        `https://graph.facebook.com/v19.0/${metaConn.ig_user_id}/media`,
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
        throw new Error(`Erro ao upload media: ${JSON.stringify(mediaData)}`);
      }
    }

    // Create carousel container
    const containerResponse = await fetch(
      `https://graph.facebook.com/v19.0/${metaConn.ig_user_id}/media`,
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
      throw new Error(`Erro ao criar container: ${JSON.stringify(containerData)}`);
    }

    // Publish
    const publishResponse = await fetch(
      `https://graph.facebook.com/v19.0/${metaConn.ig_user_id}/media_publish`,
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
      // Success
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
      throw new Error(`Erro ao publicar: ${JSON.stringify(publishData)}`);
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    });
  }
});
