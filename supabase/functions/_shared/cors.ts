import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.0';

function isAllowedOriginStatic(origin: string): boolean {
  if (!origin) return false;

  // Allow localhost on any port (development)
  if (/^https?:\/\/localhost(:\d+)?$/.test(origin)) return true;

  // Allow 127.0.0.1 on any port (development)
  if (/^https?:\/\/127\.0\.0\.1(:\d+)?$/.test(origin)) return true;

  // Allow Supabase domains
  if (/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(origin)) return true;

  // Allow Vercel preview and production domains
  if (/^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(origin)) return true;

  return false;
}

// Cache of allowed custom domains (refreshed every 5 minutes)
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

export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? '';

  // Check static whitelist first (fast, no DB call)
  let allowedOrigin = isAllowedOriginStatic(origin) ? origin : '';

  // If not in static list, check custom domains asynchronously
  // For the current request, use cached domains (sync check)
  if (!allowedOrigin && origin) {
    try {
      const originHost = new URL(origin).hostname;
      if (customDomainCache.includes(originHost)) {
        allowedOrigin = origin;
      }
    } catch {
      // Invalid origin URL
    }
    // Trigger async refresh of domain cache for future requests
    loadCustomDomains().catch(() => {});
  }

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  };
}

// Backward-compatible export for OPTIONS preflight responses.
// Uses a restrictive default; edge functions should prefer getCorsHeaders(req).
export const corsHeaders = {
  'Access-Control-Allow-Origin': '',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};
