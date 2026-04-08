import { useSyncExternalStore } from 'react';
import { getSupabaseClient } from '@/lib/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * External store that tracks localStorage changes to Supabase credentials.
 * Ensures the hook re-renders when credentials are saved (e.g., after Wizard).
 */
let listeners: Array<() => void> = [];
let snapshot: SupabaseClient | null = getSupabaseClient();

function subscribe(listener: () => void): () => void {
  listeners = [...listeners, listener];
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

function getSnapshot(): SupabaseClient | null {
  const next = getSupabaseClient();
  if (next !== snapshot) {
    snapshot = next;
  }
  return snapshot;
}

/**
 * Notify the external store that credentials have changed.
 * Call this after saving credentials via saveSupabaseCredentials().
 */
export function notifySupabaseChanged(): void {
  snapshot = getSupabaseClient();
  for (const listener of listeners) {
    listener();
  }
}

// Listen for storage events (same tab won't fire, but cross-tab will)
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === 'supabase_url' || e.key === 'supabase_anon_key') {
      notifySupabaseChanged();
    }
  });
}

/**
 * Returns the Supabase client instance or null if not configured.
 * Reactively updates when credentials change via notifySupabaseChanged().
 */
export function useSupabase(): SupabaseClient | null {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
