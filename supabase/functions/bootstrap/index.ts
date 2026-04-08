// Edge Function: bootstrap
// Executes SQL migrations server-side using the native Service Role Key.
// Receives static migration strings from the frontend (no interpolation).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.0';
import { getCorsHeaders } from '../_shared/cors.ts';

interface MigrationPayload {
  version: string;
  description: string;
  sql: string;
}

interface MigrationResult {
  version: string;
  status: 'success' | 'already_executed' | 'error';
  error?: string;
}

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Validate JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Token de autorizacao ausente' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: 'Variaveis de ambiente do Supabase nao configuradas' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the user is authenticated
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Usuario nao autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create admin client with service role key
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Parse request body
    const body = await req.json();

    // Handle init_platform_config action with parameterized query
    if (body.action === 'init_platform_config' && body.payload) {
      const { supabase_url, supabase_anon_key } = body.payload as {
        supabase_url: string;
        supabase_anon_key: string;
      };

      const { error: insertError } = await adminClient
        .from('platform_config')
        .insert({
          supabase_url,
          supabase_anon_key,
          setup_step: 1,
          setup_completed: false,
        })
        .select('id')
        .maybeSingle();

      // Ignore conflict (row already exists)
      if (insertError && !insertError.message?.includes('duplicate')) {
        return new Response(
          JSON.stringify({ error: insertError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const migrationsList: MigrationPayload[] = body.migrations;

    if (!Array.isArray(migrationsList) || migrationsList.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Lista de migrations invalida' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results: MigrationResult[] = [];

    for (const migration of migrationsList) {
      // Validate migration has required fields
      if (!migration.version || !migration.sql) {
        results.push({
          version: migration.version || 'unknown',
          status: 'error',
          error: 'Migration sem version ou sql',
        });
        continue;
      }

      // Check if already executed (skip schema_versions check for the first 3 migrations)
      if (migration.version !== '001_extensions' &&
          migration.version !== '002_platform_config' &&
          migration.version !== '003_schema_versions') {
        const { data: existing } = await adminClient
          .from('schema_versions')
          .select('version')
          .eq('version', migration.version)
          .eq('success', true)
          .maybeSingle();

        if (existing) {
          results.push({ version: migration.version, status: 'already_executed' });
          continue;
        }
      }

      // Execute migration via SQL
      try {
        // For 001_extensions (creates exec_sql), execute via direct fetch to PostgREST
        // For all other migrations, use exec_sql RPC
        if (migration.version === '001_extensions') {
          // Migration 001 creates exec_sql itself, so we can't use exec_sql RPC yet.
          // Use Supabase Management API to execute SQL directly.
          // Extract project ref from URL (e.g., https://abc123.supabase.co -> abc123)
          const urlMatch = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/);

          if (urlMatch) {
            // Try Supabase Management API (requires service role key)
            const projectRef = urlMatch[1];
            const mgmtResponse = await fetch(
              `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${serviceRoleKey}`,
                },
                body: JSON.stringify({ query: migration.sql }),
              }
            );

            if (!mgmtResponse.ok) {
              // Fallback: try PostgREST SQL endpoint
              const pgResponse = await fetch(`${supabaseUrl}/rest/v1/`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'apikey': serviceRoleKey,
                  'Authorization': `Bearer ${serviceRoleKey}`,
                  'Prefer': 'return=minimal',
                },
                body: migration.sql,
              });

              if (!pgResponse.ok) {
                throw new Error(
                  'Nao foi possivel executar migration 001. ' +
                  'Execute manualmente no Supabase SQL Editor: ' +
                  'Dashboard > SQL Editor > Cole o SQL da migration 001_extensions'
                );
              }
            }
          } else {
            // Self-hosted Supabase — try exec_sql directly (may already exist)
            const { error } = await adminClient.rpc('exec_sql', { query: migration.sql });
            if (error) {
              throw new Error(
                'Nao foi possivel executar migration 001. ' +
                'Execute manualmente no Supabase SQL Editor.'
              );
            }
          }
        } else {
          // Use exec_sql RPC (created by migration 001)
          const { error: execError } = await adminClient.rpc('exec_sql', {
            query: migration.sql,
          });

          if (execError) {
            throw new Error(`exec_sql failed: ${execError.message}`);
          }
        }

        // Register migration in schema_versions (if the table exists)
        try {
          await adminClient.from('schema_versions').insert({
            version: migration.version,
            description: migration.description,
            success: true,
          });
        } catch {
          // schema_versions may not exist yet for early migrations
        }

        results.push({ version: migration.version, status: 'success' });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);

        // Register failure
        try {
          await adminClient.from('schema_versions').insert({
            version: migration.version,
            description: migration.description,
            success: false,
            error_message: errorMessage,
          });
        } catch {
          // Ignore if schema_versions doesn't exist yet
        }

        results.push({
          version: migration.version,
          status: 'error',
          error: errorMessage,
        });
      }
    }

    return new Response(
      JSON.stringify({ results }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
