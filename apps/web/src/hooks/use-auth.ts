import { useEffect, useCallback } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { getSupabaseClient } from '@/lib/supabase';

export function useAuth() {
  const { user, session, loading, setSession, setLoading, clear } = useAuthStore();

  useEffect(() => {
    const client = getSupabaseClient();
    if (!client) {
      setLoading(false);
      return;
    }

    // Get initial session
    client.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [setSession, setLoading]);

  const signUp = useCallback(
    async (email: string, password: string) => {
      const client = getSupabaseClient();
      if (!client) throw new Error('Supabase nao configurado');
      const { data, error } = await client.auth.signUp({ email, password });
      if (error) throw error;
      return data;
    },
    []
  );

  const signIn = useCallback(
    async (email: string, password: string) => {
      const client = getSupabaseClient();
      if (!client) throw new Error('Supabase nao configurado');
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return data;
    },
    []
  );

  const signOut = useCallback(async () => {
    const client = getSupabaseClient();
    if (!client) return;
    await client.auth.signOut();
    clear();
  }, [clear]);

  const resetPassword = useCallback(async (email: string) => {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase nao configurado');
    const { error } = await client.auth.resetPasswordForEmail(email);
    if (error) throw error;
  }, []);

  return {
    user,
    session,
    loading,
    isAuthenticated: Boolean(session),
    signUp,
    signIn,
    signOut,
    resetPassword,
  };
}
