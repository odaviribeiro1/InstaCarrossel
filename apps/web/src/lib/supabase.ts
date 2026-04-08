import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let supabaseInstance: SupabaseClient | null = null;
let currentUrl: string | null = null;
let currentKey: string | null = null;

/**
 * Returns the Supabase client, creating it from localStorage credentials.
 * Returns null if credentials are not yet configured (first access / wizard).
 * Recreates the client if credentials have changed.
 */
export function getSupabaseClient(): SupabaseClient | null {
  const url = localStorage.getItem('supabase_url');
  const anonKey = localStorage.getItem('supabase_anon_key');

  if (!url || !anonKey) return null;

  // Recreate if credentials changed
  if (supabaseInstance && url === currentUrl && anonKey === currentKey) {
    return supabaseInstance;
  }

  supabaseInstance = createClient(url, anonKey);
  currentUrl = url;
  currentKey = anonKey;

  return supabaseInstance;
}

/**
 * Resets the cached Supabase client instance.
 * Call this when credentials change (e.g., during wizard setup).
 */
export function resetSupabaseClient(): void {
  supabaseInstance = null;
  currentUrl = null;
  currentKey = null;
}

/**
 * Creates a temporary Supabase client with provided credentials.
 * Used during wizard setup to validate connection before saving.
 */
export function createTemporaryClient(url: string, anonKey: string): SupabaseClient {
  return createClient(url, anonKey);
}

/**
 * Saves Supabase credentials to localStorage and resets the client.
 * Only URL and anon key are stored (never service role key).
 * Notifies any useSupabase() consumers so they re-render with the new client.
 */
export function saveSupabaseCredentials(url: string, anonKey: string): void {
  localStorage.setItem('supabase_url', url);
  localStorage.setItem('supabase_anon_key', anonKey);
  resetSupabaseClient();
  // Lazy import to avoid circular dependency at module load time
  import('@/hooks/use-supabase').then(({ notifySupabaseChanged }) => {
    notifySupabaseChanged();
  });
}

/**
 * Clears Supabase credentials from localStorage.
 */
export function clearSupabaseCredentials(): void {
  localStorage.removeItem('supabase_url');
  localStorage.removeItem('supabase_anon_key');
  resetSupabaseClient();
}

/**
 * Checks if Supabase credentials exist in localStorage.
 */
export function hasSupabaseCredentials(): boolean {
  return Boolean(localStorage.getItem('supabase_url') && localStorage.getItem('supabase_anon_key'));
}
