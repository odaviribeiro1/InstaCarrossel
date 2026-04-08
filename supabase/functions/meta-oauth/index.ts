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
    const { code, redirect_uri, workspace_id } = body;

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Verify workspace membership
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

    // Get Meta App credentials from platform_config
    const { data: config } = await adminClient
      .from('platform_config')
      .select('meta_app_id, meta_app_secret_id, meta_app_secret')
      .limit(1)
      .single();

    if (!config?.meta_app_id) {
      return new Response(JSON.stringify({ error: 'Meta App ID nao configurado' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Try Vault first, fallback to direct column
    let appSecret: string | null = null;

    if (config.meta_app_secret_id) {
      try {
        const { data: secretData } = await adminClient.rpc('vault_read', {
          secret_id: config.meta_app_secret_id,
        });
        appSecret = secretData;
      } catch {
        // Vault not available
      }
    }

    if (!appSecret && config.meta_app_secret) {
      appSecret = config.meta_app_secret;
    }

    if (!appSecret) {
      return new Response(JSON.stringify({ error: 'Meta App Secret nao configurado. Salve as credenciais na aba Instagram.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Exchange code for access token
    // NOTE: Facebook Graph API requires client_secret as query parameter.
    // This is a known limitation — the secret may appear in server logs.
    // Mitigated by: (1) running server-side in Edge Function, (2) HTTPS only,
    // (3) Supabase Edge Functions don't log query params by default.
    const tokenUrl = `https://graph.facebook.com/v19.0/oauth/access_token?client_id=${config.meta_app_id}&client_secret=${appSecret}&code=${code}&redirect_uri=${encodeURIComponent(redirect_uri)}`;

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

    // Get long-lived token
    const longLivedUrl = `https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${config.meta_app_id}&client_secret=${appSecret}&fb_exchange_token=${accessToken}`;

    const longLivedResponse = await fetch(longLivedUrl);
    const longLivedData = await longLivedResponse.json();

    const finalToken = longLivedData.access_token || accessToken;
    const finalExpiry = longLivedData.expires_in || expiresIn;

    // Get Facebook pages
    const pagesResponse = await fetch(`https://graph.facebook.com/v19.0/me/accounts?access_token=${finalToken}`);
    const pagesData = await pagesResponse.json();

    // Get Instagram Business Account for each page
    const pages = [];
    for (const page of (pagesData.data || [])) {
      const igResponse = await fetch(
        `https://graph.facebook.com/v19.0/${page.id}?fields=instagram_business_account&access_token=${finalToken}`
      );
      const igData = await igResponse.json();

      let igUsername: string | null = null;
      let igProfilePic: string | null = null;
      const igUserId = igData.instagram_business_account?.id || null;

      // Fetch IG username and profile picture if available
      if (igUserId) {
        try {
          const igProfileResponse = await fetch(
            `https://graph.facebook.com/v19.0/${igUserId}?fields=username,profile_picture_url&access_token=${finalToken}`
          );
          const igProfile = await igProfileResponse.json();
          igUsername = igProfile.username || null;
          igProfilePic = igProfile.profile_picture_url || null;
        } catch {
          // Non-critical — continue without username
        }
      }

      pages.push({
        page_id: page.id,
        page_name: page.name,
        ig_user_id: igUserId,
        ig_username: igUsername,
        ig_profile_pic: igProfilePic,
      });
    }

    // Also try to get the user's own IG account via /me (for personal accounts)
    let fbUserName: string | null = null;
    try {
      const meResponse = await fetch(
        `https://graph.facebook.com/v19.0/me?fields=name&access_token=${finalToken}`
      );
      const meData = await meResponse.json();
      fbUserName = meData.name || null;
    } catch {
      // Non-critical
    }

    // Find the best IG account
    const igPage = pages.find((p) => p.ig_user_id) || pages[0];

    // Store access token — try Vault first, fallback to direct storage
    let tokenId: string | null = null;
    try {
      const { data, error: vaultErr } = await adminClient.rpc('vault_insert', {
        new_secret: finalToken,
        new_name: `meta_access_token_${workspace_id}`,
      });
      if (!vaultErr && data) tokenId = data;
    } catch {
      // Vault not available
    }

    // Save connection
    const expiresAt = new Date(Date.now() + (finalExpiry || 5184000) * 1000).toISOString();

    const { error: connError } = await adminClient.from('meta_connections').upsert(
      {
        workspace_id,
        user_id: user.id,
        access_token_id: tokenId,
        access_token: tokenId ? null : finalToken, // Direct fallback if Vault unavailable
        ig_user_id: igPage?.ig_user_id || null,
        ig_username: igPage?.ig_username || null,
        fb_page_id: igPage?.page_id || null,
        fb_user_name: fbUserName,
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
