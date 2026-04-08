import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.0';
import { getCorsHeaders } from '../_shared/cors.ts';

/**
 * Compute HMAC-SHA256 hex digest using Web Crypto API.
 */
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

/**
 * Constant-time string comparison to prevent timing attacks.
 */
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
  // Handle verification challenge from Meta
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
    // Read raw body for signature verification
    const rawBody = await req.text();

    // Validate X-Hub-Signature-256 header
    const signatureHeader = req.headers.get('X-Hub-Signature-256');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Retrieve Meta App Secret from platform_config -> Vault
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
      // App secret is configured but no signature was sent -- reject
      console.error('Missing X-Hub-Signature-256 header');
      return new Response('Forbidden', { status: 403 });
    }

    const body = JSON.parse(rawBody);

    // Process webhook entries
    if (body.entry) {
      for (const entry of body.entry) {
        if (entry.changes) {
          for (const change of entry.changes) {
            // Update post status based on webhook event
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
