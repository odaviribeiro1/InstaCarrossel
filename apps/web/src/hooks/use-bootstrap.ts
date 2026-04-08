import { useState, useEffect } from 'react';
import { getSupabaseClient, hasSupabaseCredentials } from '@/lib/supabase';

export type BootstrapState =
  | 'loading'
  | 'no_credentials'
  | 'setup_incomplete'
  | 'ready';

export interface BootstrapStatus {
  state: BootstrapState;
  setupStep: number;
}

/**
 * Verifies the bootstrap state of the application.
 * - No credentials -> render Wizard Step 1
 * - Credentials + setup incomplete -> resume Wizard from saved step
 * - Credentials + setup complete -> load app normally
 */
export function useBootstrap(): BootstrapStatus {
  const [status, setStatus] = useState<BootstrapStatus>({
    state: 'loading',
    setupStep: 0,
  });

  useEffect(() => {
    async function checkBootstrap() {
      if (!hasSupabaseCredentials()) {
        setStatus({ state: 'no_credentials', setupStep: 0 });
        return;
      }

      const client = getSupabaseClient();
      if (!client) {
        setStatus({ state: 'no_credentials', setupStep: 0 });
        return;
      }

      try {
        // Check platform_config via RPC
        const { data, error } = await client.rpc('get_setup_status');

        if (error) {
          // If the function doesn't exist, setup hasn't been run
          setStatus({ state: 'no_credentials', setupStep: 0 });
          return;
        }

        const setupData = data as { setup_completed: boolean; setup_step: number } | null;

        if (setupData?.setup_completed) {
          setStatus({ state: 'ready', setupStep: setupData.setup_step });
          return;
        }

        // platform_config may not reflect true state (RLS blocks updates).
        // Check if user is authenticated and has a workspace as secondary signal.
        const { data: { user } } = await client.auth.getUser();
        if (user) {
          const { data: ws } = await client
            .from('workspace_members')
            .select('workspace_id')
            .eq('user_id', user.id)
            .limit(1)
            .maybeSingle();

          if (ws) {
            // User has a workspace — setup is effectively complete
            setStatus({ state: 'ready', setupStep: 7 });
            return;
          }
        }

        setStatus({
          state: 'setup_incomplete',
          setupStep: setupData?.setup_step ?? 0,
        });
      } catch {
        setStatus({ state: 'no_credentials', setupStep: 0 });
      }
    }

    void checkBootstrap();
  }, []);

  return status;
}
