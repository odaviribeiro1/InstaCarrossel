import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Loader2, CheckCircle2, XCircle, Database } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useWizardStore } from '@/stores/wizard-store';
import { saveSupabaseCredentials } from '@/lib/supabase';
import { migrations } from '@/lib/migrations';

const supabaseSchema = z.object({
  supabaseUrl: z
    .string()
    .min(1, 'URL do Supabase e obrigatoria')
    .url('URL invalida')
    .regex(
      /^https:\/\/[a-z0-9-]+\.supabase\.co$/,
      'URL deve seguir o padrao https://<projeto>.supabase.co'
    ),
  anonKey: z
    .string()
    .min(30, 'Anon Key deve ter pelo menos 30 caracteres')
    .regex(/^[A-Za-z0-9._-]+$/, 'Anon Key contem caracteres invalidos'),
  serviceRoleKey: z
    .string()
    .min(30, 'Service Role Key deve ter pelo menos 30 caracteres')
    .regex(/^[A-Za-z0-9._-]+$/, 'Service Role Key contem caracteres invalidos'),
});

type SupabaseFormValues = z.infer<typeof supabaseSchema>;

/**
 * Execute raw SQL against Supabase using the service role key via PostgREST RPC.
 * For the first migration (which creates exec_sql), we use a different approach.
 */
async function executeSql(
  supabaseUrl: string,
  serviceRoleKey: string,
  sql: string
): Promise<{ ok: boolean; error?: string }> {
  // Try via exec_sql RPC (works after migration 001)
  const rpcResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': serviceRoleKey,
      'Authorization': `Bearer ${serviceRoleKey}`,
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify({ query: sql }),
  });

  if (rpcResponse.ok || rpcResponse.status === 204) {
    return { ok: true };
  }

  // If exec_sql doesn't exist yet, the RPC returns 404
  // This is expected for the first migration
  const text = await rpcResponse.text();

  if (rpcResponse.status === 404 || text.includes('Could not find the function')) {
    return { ok: false, error: 'EXEC_SQL_NOT_FOUND' };
  }

  return { ok: false, error: `HTTP ${rpcResponse.status}: ${text}` };
}

export function WizardStep1Supabase() {
  const { setCurrentStep, setSupabaseCredentials, setIsRunningMigrations, setMigrationProgress } =
    useWizardStore();
  const [connectionStatus, setConnectionStatus] = useState<
    'idle' | 'testing' | 'success' | 'error'
  >('idle');
  const [migrationStatus, setMigrationStatus] = useState<
    'idle' | 'running' | 'success' | 'error'
  >('idle');
  const [currentMigration, setCurrentMigration] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [showFirstMigrationSql, setShowFirstMigrationSql] = useState(false);
  const [sqlCopied, setSqlCopied] = useState(false);

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<SupabaseFormValues>({
    resolver: zodResolver(supabaseSchema),
    defaultValues: {
      supabaseUrl: '',
      anonKey: '',
      serviceRoleKey: '',
    },
  });

  async function testConnection() {
    const { supabaseUrl, anonKey } = getValues();

    if (!supabaseUrl || !anonKey) {
      toast.error('Preencha a URL e Anon Key antes de testar');
      return;
    }

    setConnectionStatus('testing');
    setErrorMessage('');

    try {
      // Test connection with a simple fetch to the PostgREST endpoint
      // On a fresh Supabase project, 401 is expected (no public tables) — still means connection works
      const response = await fetch(`${supabaseUrl}/rest/v1/`, {
        headers: {
          'apikey': anonKey,
          'Authorization': `Bearer ${anonKey}`,
        },
      });

      // Any HTTP response means the server is reachable and the URL is valid
      // 200 = tables exist, 401 = fresh project (normal), 404 = endpoint exists
      if (response.status >= 200 && response.status < 500) {
        setConnectionStatus('success');
        setShowFirstMigrationSql(true);
        toast.success('Conexao estabelecida com sucesso');
      } else {
        throw new Error(`Servidor retornou HTTP ${response.status}`);
      }
    } catch (err) {
      setConnectionStatus('error');
      const msg = err instanceof Error ? err.message : 'Erro ao conectar';
      if (msg.includes('fetch') || msg.includes('NetworkError') || msg.includes('Failed')) {
        setErrorMessage('Nao foi possivel conectar. Verifique a URL.');
        toast.error('Nao foi possivel conectar. Verifique a URL.');
      } else {
        setErrorMessage(msg);
        toast.error(msg);
      }
    }
  }

  async function onSubmit(data: SupabaseFormValues) {
    setMigrationStatus('running');
    setIsRunningMigrations(true);
    setErrorMessage('');
    setShowFirstMigrationSql(false);

    try {
      const totalMigrations = migrations.length;

      for (let i = 0; i < migrations.length; i++) {
        const migration = migrations[i]!;
        setCurrentMigration(migration.description);
        setMigrationProgress(i + 1, totalMigrations, migration.version);

        // Try to execute via exec_sql RPC
        const result = await executeSql(data.supabaseUrl, data.serviceRoleKey, migration.sql);

        if (result.ok) {
          continue; // Success, next migration
        }

        // If exec_sql doesn't exist, handle first migration specially
        if (result.error === 'EXEC_SQL_NOT_FOUND') {
          if (i === 0) {
            // First migration creates exec_sql — user needs to run it manually once
            setShowFirstMigrationSql(true);
            throw new Error(
              'A funcao exec_sql ainda nao existe no banco de dados.\n\n' +
              'Copie o SQL abaixo e execute no SQL Editor do Supabase Dashboard:\n' +
              'Dashboard > SQL Editor > New Query > Cole e Execute\n\n' +
              'Depois clique em "Conectar e Configurar Banco" novamente.'
            );
          } else {
            throw new Error(
              `Migration ${migration.version} falhou: exec_sql nao disponivel. ` +
              'Execute a migration 001 primeiro no SQL Editor do Supabase.'
            );
          }
        }

        // Other error
        throw new Error(`Migration ${migration.version} falhou: ${result.error}`);
      }

      // All migrations succeeded — create platform_config row
      const insertResult = await executeSql(
        data.supabaseUrl,
        data.serviceRoleKey,
        `INSERT INTO platform_config (supabase_url, supabase_anon_key, setup_step, setup_completed)
         VALUES ('${data.supabaseUrl.replace(/'/g, "''")}', '${data.anonKey.replace(/'/g, "''")}', 1, false)
         ON CONFLICT DO NOTHING;`
      );

      if (!insertResult.ok) {
        console.warn('Aviso: nao foi possivel criar platform_config inicial:', insertResult.error);
      }

      // Migrations succeeded — NOW save credentials (never save service role key)
      saveSupabaseCredentials(data.supabaseUrl, data.anonKey);
      setSupabaseCredentials(data.supabaseUrl, data.anonKey);

      setMigrationStatus('success');
      setIsRunningMigrations(false);
      toast.success('Banco de dados configurado com sucesso!');

      // Advance to next step
      setCurrentStep(2);
    } catch (err) {
      setMigrationStatus('error');
      setIsRunningMigrations(false);
      const msg = err instanceof Error ? err.message : 'Erro ao executar migrations';
      setErrorMessage(msg);
      toast.error('Erro na configuracao do banco de dados');
    }
  }

  const firstMigrationSql = migrations[0]?.sql ?? '';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[rgba(59,130,246,0.1)]">
            <Database className="h-5 w-5 text-[#3B82F6]" />
          </div>
          <div>
            <CardTitle>Conectar Supabase</CardTitle>
            <CardDescription>
              Insira as credenciais do seu projeto Supabase para configurar o banco de dados.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="supabaseUrl">URL do Projeto</Label>
            <Input
              id="supabaseUrl"
              placeholder="https://seu-projeto.supabase.co"
              {...register('supabaseUrl')}
            />
            {errors.supabaseUrl && (
              <p className="text-sm text-red-400">{errors.supabaseUrl.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="serviceRoleKey">Service Role Key (secreta)</Label>
            <Input
              id="serviceRoleKey"
              placeholder="eyJhbGciOiJIUzI1NiIs..."
              type="password"
              {...register('serviceRoleKey')}
            />
            {errors.serviceRoleKey && (
              <p className="text-sm text-red-400">{errors.serviceRoleKey.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="anonKey">Anon Key (publica)</Label>
            <Input
              id="anonKey"
              placeholder="eyJhbGciOiJIUzI1NiIs..."
              type="password"
              {...register('anonKey')}
            />
            {errors.anonKey && (
              <p className="text-sm text-red-400">{errors.anonKey.message}</p>
            )}
          </div>

          {/* Connection test button */}
          <Button
            type="button"
            variant="outline"
            onClick={testConnection}
            disabled={connectionStatus === 'testing'}
            className="w-full"
          >
            {connectionStatus === 'testing' && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {connectionStatus === 'success' && (
              <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" />
            )}
            {connectionStatus === 'error' && (
              <XCircle className="mr-2 h-4 w-4 text-red-400" />
            )}
            Testar Conexao
          </Button>

          {/* Only show the rest after successful connection test */}
          {connectionStatus === 'success' && (
            <>
              {/* Migration progress */}
              {migrationStatus === 'running' && (
                <div className="space-y-2 rounded-lg border p-4">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-[#3B82F6]" />
                    <p className="text-sm font-medium">Configurando banco de dados...</p>
                  </div>
                  <p className="text-xs text-[#94A3B8]">
                    {currentMigration}
                  </p>
                </div>
              )}

              {/* First migration SQL for manual execution */}
              {showFirstMigrationSql && (
                <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-4">
                  <p className="text-sm font-medium text-amber-800">
                    Primeira configuracao: execute este SQL no Supabase Dashboard (SQL Editor):
                  </p>
                  <div className="relative">
                    <pre className="max-h-48 overflow-auto rounded bg-gray-900 p-3 text-xs text-green-400 font-mono">
                      {firstMigrationSql}
                    </pre>
                    <Button
                      type="button"
                      size="sm"
                      variant={sqlCopied ? 'default' : 'outline'}
                      className={`absolute top-2 right-2 h-7 text-xs ${!sqlCopied ? 'animate-pulse ring-2 ring-primary ring-offset-2' : ''}`}
                      onClick={() => {
                        navigator.clipboard.writeText(firstMigrationSql);
                        setSqlCopied(true);
                        toast.success('SQL copiado! Cole no SQL Editor do Supabase e execute.');
                      }}
                    >
                      {sqlCopied ? (
                        <>
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          Copiado
                        </>
                      ) : (
                        'Copiar'
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-amber-700">
                    Apos executar no Supabase, clique em "Conectar e Configurar Banco" abaixo.
                  </p>
                </div>
              )}

              {/* Error message */}
              {errorMessage && migrationStatus === 'error' && !showFirstMigrationSql && (
                <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
                  <p className="text-sm text-red-400 whitespace-pre-wrap">{errorMessage}</p>
                </div>
              )}

              <Button
                type="submit"
                className={`w-full transition-all duration-300 ${
                  showFirstMigrationSql && !sqlCopied
                    ? 'opacity-40 cursor-not-allowed'
                    : showFirstMigrationSql && sqlCopied
                      ? 'animate-pulse-slow ring-2 ring-primary ring-offset-2'
                      : ''
                }`}
                disabled={migrationStatus === 'running' || (showFirstMigrationSql && !sqlCopied)}
              >
                {migrationStatus === 'running' ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Configurando...
                  </>
                ) : (
                  'Conectar e Configurar Banco'
                )}
              </Button>
            </>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
